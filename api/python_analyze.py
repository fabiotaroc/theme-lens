from __future__ import annotations

import json
import math
import os
import re
from pathlib import Path
from datetime import datetime
from collections import Counter
from typing import Any

import hdbscan
import numpy as np
from fastapi import FastAPI, HTTPException
from openai import OpenAI
from pydantic import BaseModel
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import silhouette_score


def load_repo_env() -> None:
    env_dir = Path(__file__).resolve().parent.parent
    env_path = env_dir / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        if line.startswith("export "):
            line = line[7:].strip()

        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if not key:
            continue

        if (
            len(value) >= 2
            and value[0] == value[-1]
            and value[0] in {"'", '"'}
        ):
            value = value[1:-1]

        os.environ.setdefault(key, value)


load_repo_env()

app = FastAPI()

EMBEDDING_MODEL = "text-embedding-3-small"
LABELING_MODEL = "gpt-4o-mini"
EMBEDDING_BATCH_SIZE = 128
LOW_CONFIDENCE_THRESHOLD = 0.45
HDBSCAN_MIN_CLUSTER_SIZE_FLOOR = 3
HDBSCAN_MIN_CLUSTER_SIZE_CAP = 8
HDBSCAN_MIN_SAMPLES = 1
NOISE_RATIO_FALLBACK_THRESHOLD = 0.4
DOMINANT_CLUSTER_FALLBACK_THRESHOLD = 0.8
NOISE_REASSIGNMENT_SIMILARITY_THRESHOLD = 0.82
NOISE_REASSIGNMENT_MARGIN_THRESHOLD = 0.04
DOMINANT_CLUSTER_REASSIGNMENT_SIMILARITY_THRESHOLD = 0.9
KMEANS_TARGET_MAX_CLUSTER_SHARE = 0.55
KMEANS_DOMINANT_CLUSTER_PENALTY = 0.8

COMMON_STOPWORDS = [
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "have",
    "i",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "that",
    "the",
    "their",
    "there",
    "this",
    "to",
    "was",
    "were",
    "with",
    "you",
    "your",
    "we",
    "our",
    "they",
    "them",
    "very",
    "just",
    "not",
    "but",
    "can",
    "could",
    "would",
    "should",
    "do",
    "did",
    "done",
    "so",
    "if",
    "my",
    "me",
    "about",
    "into",
    "after",
    "before",
    "than",
    "then",
    "also",
    "all",
    "more",
    "most",
    "some",
    "such",
    "di",
    "da",
    "del",
    "della",
    "dei",
    "degli",
    "delle",
    "il",
    "lo",
    "la",
    "le",
    "gli",
    "un",
    "una",
    "uno",
    "e",
    "che",
    "con",
    "per",
    "su",
    "tra",
    "fra",
    "sono",
    "non",
    "piu",
    "più",
    "molto",
    "come",
    "anche",
    "ma",
    "ho",
    "ha",
    "avevo",
    "avere",
    "essere",
    "quello",
    "questa",
    "questo",
    "dopo",
    "prima",
    "nel",
    "nella",
    "nelle",
    "nei",
    "al",
    "allo",
    "alla",
    "alle",
    "agli",
    "ai",
    "mi",
    "ti",
    "ci",
    "si",
    "voi",
    "loro",
    "yo",
    "tu",
    "el",
    "los",
    "las",
    "de",
    "para",
    "por",
    "que",
    "les",
    "des",
    "dans",
    "pour",
    "avec",
    "sur",
    "pas",
    "plus",
    "une",
    "est",
    "sont",
]

POSITIVE_CUES = [
    "good",
    "great",
    "excellent",
    "easy",
    "helpful",
    "friendly",
    "smooth",
    "clear",
    "fast",
    "love",
    "useful",
    "satisfied",
    "happy",
    "recommend",
    "works well",
    "resolved",
    "ottimo",
    "bene",
    "buono",
    "facile",
    "chiaro",
    "veloce",
    "utile",
    "gentile",
    "professionale",
    "soddisfatto",
    "funziona bene",
    "risolto",
    "eccellente",
]

NEGATIVE_CUES = [
    "bad",
    "poor",
    "broken",
    "issue",
    "problem",
    "difficult",
    "confusing",
    "slow",
    "expensive",
    "frustrating",
    "disappointed",
    "hate",
    "doesn't work",
    "does not work",
    "waiting",
    "delay",
    "bug",
    "hard",
    "worse",
    "male",
    "scarso",
    "rotto",
    "problema",
    "difficile",
    "confuso",
    "lento",
    "caro",
    "frustrante",
    "deluso",
    "non funziona",
    "guasto",
    "attesa",
    "ritardo",
]


class AnalysisPayloadRow(BaseModel):
    id: str
    rowNumber: int
    text: str
    metadata: dict[str, str]


class AnalysisPayload(BaseModel):
    fileName: str
    sheetName: str
    totalRows: int
    textColumn: str
    metadataColumns: list[str]
    languageHint: str
    rows: list[AnalysisPayloadRow]


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def tokenize_words(text: str) -> list[str]:
    normalized = re.sub(r"[^\w\s'-]", " ", text.lower(), flags=re.UNICODE)
    return [token for token in normalized.split() if len(token) >= 3]


def classify_sentiment(text: str) -> str:
    lower = text.lower()
    score = 0
    for cue in POSITIVE_CUES:
        if cue in lower:
            score += 1
    for cue in NEGATIVE_CUES:
        if cue in lower:
            score -= 1
    if score > 0:
        return "positive"
    if score < 0:
        return "negative"
    return "neutral"


def is_tag_like(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False

    tokens = stripped.split()
    letters = re.findall(r"[A-Za-zÀ-ÿ]", stripped)
    punctuation_count = len(re.findall(r"[.,;:!?]", stripped))
    uppercase_letters = "".join(ch for ch in stripped if ch.isalpha())

    if re.fullmatch(r"[A-Z0-9_\-/ ]{2,32}", stripped) and len(tokens) <= 4:
        return True
    if len(tokens) <= 3 and punctuation_count == 0 and stripped.upper() == stripped:
        return True
    if len(tokens) <= 2 and len(letters) <= 18 and punctuation_count == 0:
        return True
    if uppercase_letters and uppercase_letters == uppercase_letters.upper() and len(tokens) <= 3:
        return True

    return False


def is_short_comment(text: str) -> bool:
    tokens = tokenize_words(text)
    return len(tokens) < 3 or len(text) < 15


def average(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def average_sentiment_breakdown(rows: list[dict[str, Any]]) -> dict[str, int]:
    breakdown = {"positive": 0, "neutral": 0, "negative": 0}
    for row in rows:
        breakdown[row["sentiment"]] += 1
    return breakdown


def build_embeddings(client: OpenAI, texts: list[str]) -> np.ndarray:
    embeddings: list[list[float]] = []
    for start in range(0, len(texts), EMBEDDING_BATCH_SIZE):
        batch = texts[start : start + EMBEDDING_BATCH_SIZE]
        response = client.embeddings.create(model=EMBEDDING_MODEL, input=batch)
        embeddings.extend(item.embedding for item in response.data)
    return np.array(embeddings, dtype=np.float32)


def reduce_dimensions(embeddings: np.ndarray) -> np.ndarray:
    if embeddings.shape[0] <= 2:
        return embeddings

    n_components = min(30, embeddings.shape[0] - 1, embeddings.shape[1])
    if n_components < 2:
        return embeddings

    return PCA(n_components=n_components, random_state=42).fit_transform(embeddings)


def normalize_rows(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    safe_norms = np.where(norms == 0, 1.0, norms)
    return matrix / safe_norms


def largest_cluster_share(labels: np.ndarray) -> float:
    valid_labels = [int(label) for label in labels.tolist() if int(label) >= 0]
    if not valid_labels:
        return 0.0
    counts = Counter(valid_labels)
    return max(counts.values()) / len(valid_labels)


def cluster_with_hdbscan(points: np.ndarray) -> tuple[np.ndarray, np.ndarray, bool]:
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=max(
            HDBSCAN_MIN_CLUSTER_SIZE_FLOOR,
            min(HDBSCAN_MIN_CLUSTER_SIZE_CAP, math.ceil(math.sqrt(len(points)) * 0.75)),
        ),
        min_samples=HDBSCAN_MIN_SAMPLES,
        metric="euclidean",
        cluster_selection_method="eom",
        prediction_data=False,
    )
    labels = clusterer.fit_predict(points)
    probabilities = getattr(clusterer, "probabilities_", np.zeros(len(points), dtype=float))
    valid_labels = sorted({int(label) for label in labels if label >= 0})
    return labels, probabilities, len(valid_labels) >= 2


def reassign_noise_points(
    embeddings: np.ndarray,
    labels: np.ndarray,
    confidences: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, int]:
    cluster_ids = sorted({int(label) for label in labels if label >= 0})
    noise_indices = np.where(labels < 0)[0]

    if not cluster_ids or len(noise_indices) == 0:
        return labels, confidences, 0

    normalized_embeddings = normalize_rows(embeddings)
    centroid_vectors: list[np.ndarray] = []
    centroid_labels: list[int] = []

    for cluster_id in cluster_ids:
        cluster_indices = np.where(labels == cluster_id)[0]
        if len(cluster_indices) == 0:
            continue
        centroid = normalize_rows(
            np.mean(normalized_embeddings[cluster_indices], axis=0, keepdims=True)
        )[0]
        centroid_vectors.append(centroid)
        centroid_labels.append(cluster_id)

    if not centroid_vectors:
        return labels, confidences, 0

    centroid_matrix = np.vstack(centroid_vectors)
    cluster_sizes = Counter(int(label) for label in labels.tolist() if int(label) >= 0)
    total_clustered = sum(cluster_sizes.values())
    reassigned_count = 0

    for index in noise_indices:
        similarities = centroid_matrix @ normalized_embeddings[index]
        best_match = int(np.argmax(similarities))
        similarity = float(similarities[best_match])
        sorted_similarities = np.sort(similarities)
        second_best_similarity = (
            float(sorted_similarities[-2]) if len(sorted_similarities) > 1 else -1.0
        )
        target_cluster_id = centroid_labels[best_match]
        target_cluster_share = (
            cluster_sizes[target_cluster_id] / total_clustered if total_clustered else 0.0
        )
        required_similarity = (
            DOMINANT_CLUSTER_REASSIGNMENT_SIMILARITY_THRESHOLD
            if target_cluster_share >= KMEANS_TARGET_MAX_CLUSTER_SHARE
            else NOISE_REASSIGNMENT_SIMILARITY_THRESHOLD
        )
        if similarity < required_similarity:
            continue
        if similarity - second_best_similarity < NOISE_REASSIGNMENT_MARGIN_THRESHOLD:
            continue
        labels[index] = target_cluster_id
        confidences[index] = max(confidences[index], similarity)
        reassigned_count += 1

    return labels, np.clip(confidences, 0.0, 1.0), reassigned_count


def kmeans_confidences(points: np.ndarray, labels: np.ndarray, centroids: np.ndarray) -> np.ndarray:
    confidences = np.zeros(len(points), dtype=float)
    for cluster_id in sorted(set(int(label) for label in labels)):
        cluster_indices = np.where(labels == cluster_id)[0]
        cluster_points = points[cluster_indices]
        centroid = centroids[cluster_id]
        distances = np.linalg.norm(cluster_points - centroid, axis=1)
        max_distance = float(np.max(distances)) if len(distances) else 0.0
        if max_distance <= 0:
            confidences[cluster_indices] = 1.0
            continue
        confidences[cluster_indices] = 1.0 - (distances / max_distance)
    return np.clip(confidences, 0.0, 1.0)


def cluster_with_kmeans(points: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    max_clusters = min(8, max(2, int(math.sqrt(len(points)))))
    best_candidate: tuple[float, float, int] | None = None
    best_labels: np.ndarray | None = None
    best_centroids: np.ndarray | None = None

    for cluster_count in range(2, max_clusters + 1):
        model = KMeans(n_clusters=cluster_count, random_state=42, n_init=10)
        labels = model.fit_predict(points)
        if len(set(labels.tolist())) < 2:
            continue
        try:
            score = silhouette_score(points, labels)
        except ValueError:
            continue
        dominant_share = largest_cluster_share(labels)
        adjusted_score = score - max(
            0.0,
            dominant_share - KMEANS_TARGET_MAX_CLUSTER_SHARE,
        ) * KMEANS_DOMINANT_CLUSTER_PENALTY
        candidate = (adjusted_score, -dominant_share, cluster_count)
        if best_candidate is None or candidate > best_candidate:
            best_candidate = candidate
            best_labels = labels
            best_centroids = model.cluster_centers_

    if best_labels is None or best_centroids is None:
        fallback = KMeans(n_clusters=1, random_state=42, n_init=10).fit(points)
        labels = fallback.labels_
        centroids = fallback.cluster_centers_
    else:
        labels = best_labels
        centroids = best_centroids

    return labels, kmeans_confidences(points, labels, centroids)


def extract_keywords_fallback(texts: list[str], n_keywords: int = 8) -> list[str]:
    counts: Counter[str] = Counter()
    stopwords = set(COMMON_STOPWORDS)

    for text in texts:
        tokens = [token for token in tokenize_words(text) if token not in stopwords]
        counts.update(tokens)
        counts.update(
            " ".join(pair)
            for pair in zip(tokens, tokens[1:])
            if pair[0] != pair[1]
        )

    return [term for term, _ in counts.most_common(n_keywords)]


def extract_keywords(texts: list[str], n_keywords: int = 8) -> list[str]:
    if len(texts) < 2:
        return []

    vectorizer = TfidfVectorizer(
        stop_words=COMMON_STOPWORDS,
        max_features=250,
        min_df=1,
        max_df=1.0 if len(texts) < 5 else 0.95,
        ngram_range=(1, 2),
    )
    try:
        matrix = vectorizer.fit_transform(texts)
    except ValueError:
        return extract_keywords_fallback(texts, n_keywords)

    mean_scores = np.asarray(matrix.mean(axis=0)).flatten()
    feature_names = vectorizer.get_feature_names_out()
    top_indices = mean_scores.argsort()[-n_keywords:][::-1]
    keywords = [feature_names[index] for index in top_indices if mean_scores[index] > 0]
    if keywords:
        return keywords
    return extract_keywords_fallback(texts, n_keywords)


def infer_fallback_label(keywords: list[str], samples: list[str], kind: str) -> dict[str, str]:
    if kind == "unclustered":
        return {
            "label": "Unclustered feedback",
            "description": "Comments that did not form a dense enough semantic theme.",
            "sentiment": "mixed",
        }

    keyword_text = " ".join(keywords).lower()
    label = " / ".join(keyword.title() for keyword in keywords[:2]) or "General feedback"

    if re.search(r"(price|cost|expensive|pricing|caro|prezzo|costo)", keyword_text):
        label = "Pricing and value"
    elif re.search(r"(support|service|help|staff|assistenza|servizio|personale)", keyword_text):
        label = "Support experience"
    elif re.search(r"(setup|use|easy|difficult|confusing|facile|difficile|uso)", keyword_text):
        label = "Ease of use"
    elif re.search(r"(quality|performance|broken|issue|bug|funziona|problem|problema)", keyword_text):
        label = "Product performance"
    elif re.search(r"(delay|wait|slow|tempo|attesa|ritardo)", keyword_text):
        label = "Speed and delays"
    elif re.search(r"(app|portal|login|website|digital|online)", keyword_text):
        label = "Digital experience"

    description = (
        f"Comments centered on {', '.join(keywords[:3])}."
        if keywords
        else f'Comments with related language patterns such as "{samples[0] if samples else ""}".'
    )
    sample_sentiments = [classify_sentiment(sample) for sample in samples]
    positives = sample_sentiments.count("positive")
    negatives = sample_sentiments.count("negative")
    sentiment = "mixed"
    if positives > negatives:
        sentiment = "positive"
    elif negatives > positives:
        sentiment = "negative"

    return {
        "label": label,
        "description": description,
        "sentiment": sentiment,
    }


def label_themes_with_gpt(
    client: OpenAI,
    items: list[dict[str, Any]],
) -> dict[str, dict[str, str]]:
    if not items:
        return {}

    response = client.chat.completions.create(
        model=LABELING_MODEL,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a qualitative research analyst. For each clustered theme, "
                    "return a concise JSON object with a top-level themes array. Every item "
                    "must contain id, label, description, and sentiment. sentiment must be "
                    "one of positive, mixed, or negative."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "themes": items,
                        "instructions": (
                            "Use short business-readable labels. Keep labels under 6 words and "
                            "descriptions to one sentence."
                        ),
                    }
                ),
            },
        ],
    )

    raw = response.choices[0].message.content
    if not raw:
        return {}

    parsed = json.loads(raw)
    results: dict[str, dict[str, str]] = {}
    for theme in parsed.get("themes", []):
        theme_id = str(theme.get("id", ""))
        if not theme_id:
            continue
        results[theme_id] = {
            "label": str(theme.get("label", "")).strip() or "General feedback",
            "description": str(theme.get("description", "")).strip()
            or "A semantically related group of comments.",
            "sentiment": str(theme.get("sentiment", "mixed")).strip() or "mixed",
        }
    return results


def pick_representative_samples(
    entry_indices: list[int],
    points: np.ndarray,
    texts: list[str],
    confidences: np.ndarray,
) -> list[str]:
    if not entry_indices:
        return []
    if len(entry_indices) <= 3:
        return [texts[index] for index in entry_indices]

    ranked = sorted(
        entry_indices,
        key=lambda index: (-float(confidences[index]), len(texts[index])),
    )
    return [texts[index] for index in ranked[:3]]


def summarize_notes(
    excluded_short_rows: int,
    excluded_taglike_rows: int,
    unclustered_rows: int,
    reassigned_noise_rows: int,
    used_fallback: bool,
) -> list[str]:
    notes = [
        "Theme labels are AI-generated and should be reviewed before external sharing.",
        "Sentiment is directional only and should be treated as a rough signal.",
    ]
    if excluded_short_rows:
        notes.append(
            f"{excluded_short_rows} very short comments were excluded from semantic clustering."
        )
    if excluded_taglike_rows:
        notes.append(
            f"{excluded_taglike_rows} short tag-like entries were excluded from semantic clustering."
        )
    if unclustered_rows:
        notes.append(
            f"{unclustered_rows} comments stayed in an unclustered bucket because they did not form a dense theme."
        )
    if reassigned_noise_rows:
        notes.append(
            f"{reassigned_noise_rows} comments were reassigned from noise into their nearest semantic theme."
        )
    if used_fallback:
        notes.append(
            "HDBSCAN did not find enough stable clusters, so a deterministic k-means fallback was used."
        )
    return notes


def build_report(summary: dict[str, Any], themes: list[dict[str, Any]]) -> dict[str, Any]:
    ranked = [theme for theme in themes if theme["kind"] == "cluster"]
    ranked.sort(key=lambda item: item["count"], reverse=True)
    top_themes = ranked[:3]

    headline = (
        f"{top_themes[0]['label']} leads the first-pass theme map"
        if top_themes
        else "ThemeLens generated an initial insight pack"
    )

    overview_parts = [
        f"ThemeLens reviewed {summary['analyzedRows']} rows from {summary['fileName']}.",
        (
            f"The largest clustered theme is {top_themes[0]['label']} at {round(top_themes[0]['share'] * 100)}% of analyzed rows."
            if top_themes
            else "No clear clustered themes were detected."
        ),
        (
            f"The dataset appears primarily {summary['languageHint'].lower()}."
            if summary["languageHint"] != "Mixed / unknown"
            else "The dataset language looks mixed or uncertain."
        ),
    ]

    takeaways = [
        f"{theme['label']}: {theme['description']} ({theme['count']} rows, {round(theme['share'] * 100)}%)."
        for theme in top_themes
    ]

    unclustered = next((theme for theme in themes if theme["kind"] == "unclustered"), None)
    if unclustered:
        takeaways.append(
            f"Unclustered feedback: {unclustered['count']} rows remained outside dense themes and should be reviewed separately."
        )

    return {
        "headline": headline,
        "overview": " ".join(overview_parts),
        "takeaways": takeaways[:4],
    }


def build_metadata_value_counts(
    rows: list[dict[str, Any]],
    metadata_columns: list[str],
) -> dict[str, list[dict[str, Any]]]:
    result: dict[str, list[dict[str, Any]]] = {}
    for column in metadata_columns:
        counter: Counter[str] = Counter()
        for row in rows:
            value = row["metadata"].get(column, "")
            if value:
                counter[value] += 1
        result[column] = [
            {"value": value, "count": count}
            for value, count in counter.most_common(8)
        ]
    return result


def analyze_payload(payload: AnalysisPayload) -> dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="OPENAI_API_KEY must be set for the Python topic-modelling backend.",
        )

    client = OpenAI(api_key=api_key)

    usable_rows = 0
    removed_empty_rows = 0
    excluded_short_rows = 0
    excluded_taglike_rows = 0
    all_unique_texts: set[str] = set()
    entries: list[dict[str, Any]] = []
    evidence_rows: list[dict[str, Any]] = []

    for item in payload.rows:
        text = clean_text(item.text)
        metadata = {key: clean_text(value) for key, value in item.metadata.items() if clean_text(value)}

        if not text:
            removed_empty_rows += 1
            continue

        usable_rows += 1
        normalized = text.lower()
        all_unique_texts.add(normalized)

        if is_tag_like(text):
            assignment_type = "excluded_taglike"
            excluded_taglike_rows += 1
        elif is_short_comment(text):
            assignment_type = "excluded_short"
            excluded_short_rows += 1
        else:
            assignment_type = "clustered"

        row_data = {
            "id": item.id,
            "rowNumber": item.rowNumber,
            "text": text,
            "metadata": metadata,
            "sentiment": classify_sentiment(text),
            "themeId": None,
            "assignmentType": assignment_type,
            "assignmentConfidence": None,
        }
        evidence_rows.append(row_data)

        if assignment_type != "clustered":
            continue

        entries.append(
            {
                "text": text,
                "rows": [row_data],
            }
        )

    unique_rows = len(all_unique_texts)
    duplicate_rows = usable_rows - unique_rows

    texts = [entry["text"] for entry in entries]

    themes: list[dict[str, Any]] = []
    cluster_count = 0
    unclustered_row_count = 0
    used_fallback_clustering = False
    average_theme_confidence: float | None = None
    reassigned_noise_rows = 0

    if texts:
        embeddings = build_embeddings(client, texts)
        reduced = reduce_dimensions(embeddings)

        if len(texts) >= 6:
            labels, confidences, has_clusters = cluster_with_hdbscan(reduced)
            labels, confidences, reassigned_noise_rows = reassign_noise_points(
                embeddings,
                labels,
                confidences,
            )
            clustering_method = (
                "HDBSCAN + noise reassignment"
                if reassigned_noise_rows
                else "HDBSCAN"
            )
            post_reassignment_noise_ratio = float(np.mean(labels < 0))
            dominant_cluster_share = largest_cluster_share(labels)
            if (
                not has_clusters
                or post_reassignment_noise_ratio > NOISE_RATIO_FALLBACK_THRESHOLD
                or dominant_cluster_share > DOMINANT_CLUSTER_FALLBACK_THRESHOLD
            ):
                labels, confidences = cluster_with_kmeans(reduced)
                clustering_method = "KMeans fallback"
                used_fallback_clustering = True
                reassigned_noise_rows = 0
        elif len(texts) >= 2:
            labels, confidences = cluster_with_kmeans(reduced)
            clustering_method = "KMeans fallback"
            used_fallback_clustering = True
        else:
            labels = np.full(len(texts), -1, dtype=int)
            confidences = np.zeros(len(texts), dtype=float)
            clustering_method = "single-comment bucket"

        cluster_ids = sorted(label for label in set(labels.tolist()) if label >= 0)
        cluster_count = len(cluster_ids)

        theme_inputs: list[dict[str, Any]] = []
        cluster_theme_data: list[dict[str, Any]] = []

        ordered_cluster_ids = sorted(
            cluster_ids,
            key=lambda label: sum(len(entries[index]["rows"]) for index, value in enumerate(labels) if value == label),
            reverse=True,
        )

        for order_index, cluster_label in enumerate(ordered_cluster_ids, start=1):
            entry_indices = [index for index, value in enumerate(labels.tolist()) if value == cluster_label]
            cluster_rows = [row for index in entry_indices for row in entries[index]["rows"]]
            row_ids = [row["id"] for row in cluster_rows]
            keywords = extract_keywords([texts[index] for index in entry_indices])
            sample_quotes = pick_representative_samples(entry_indices, reduced, texts, confidences)
            confidence = round(float(np.mean(confidences[entry_indices])), 4) if entry_indices else None

            theme_id = f"theme-{order_index}"
            for index in entry_indices:
                for row in entries[index]["rows"]:
                    row["themeId"] = theme_id
                    row["assignmentType"] = "clustered"
                    row["assignmentConfidence"] = round(float(confidences[index]), 4)

            fallback_label = infer_fallback_label(keywords, sample_quotes, "cluster")
            theme_payload = {
                "id": theme_id,
                "clusterId": cluster_label,
                "kind": "cluster",
                "label": fallback_label["label"],
                "generatedLabel": fallback_label["label"],
                "description": fallback_label["description"],
                "keywords": keywords,
                "count": len(cluster_rows),
                "share": 0.0,
                "confidence": confidence,
                "sampleQuotes": sample_quotes,
                "sentimentBreakdown": average_sentiment_breakdown(cluster_rows),
                "rowIds": row_ids,
                "source": "fallback",
                "diagnostics": {
                    "uniqueCommentCount": len(entry_indices),
                    "lowConfidenceRowCount": sum(
                        1 for index in entry_indices if float(confidences[index]) < LOW_CONFIDENCE_THRESHOLD
                    ),
                },
            }
            cluster_theme_data.append(theme_payload)
            theme_inputs.append(
                {
                    "id": theme_id,
                    "keywords": keywords,
                    "samples": sample_quotes,
                }
            )

        try:
            labels_by_theme_id = label_themes_with_gpt(client, theme_inputs)
        except Exception:
            labels_by_theme_id = {}

        for theme in cluster_theme_data:
            label = labels_by_theme_id.get(theme["id"])
            if label:
                theme["label"] = label["label"]
                theme["generatedLabel"] = label["label"]
                theme["description"] = label["description"]
                theme["source"] = "model"

        themes.extend(cluster_theme_data)

        unclustered_indices = [index for index, value in enumerate(labels.tolist()) if value < 0]
        if unclustered_indices:
            unclustered_rows = [row for index in unclustered_indices for row in entries[index]["rows"]]
            unclustered_row_count = len(unclustered_rows)
            for index in unclustered_indices:
                for row in entries[index]["rows"]:
                    row["themeId"] = "theme-unclustered"
                    row["assignmentType"] = "unclustered"
                    row["assignmentConfidence"] = round(float(confidences[index]), 4)

            sample_quotes = [texts[index] for index in unclustered_indices[:3]]
            fallback_label = infer_fallback_label([], sample_quotes, "unclustered")
            themes.append(
                {
                    "id": "theme-unclustered",
                    "kind": "unclustered",
                    "label": fallback_label["label"],
                    "generatedLabel": fallback_label["label"],
                    "description": fallback_label["description"],
                    "keywords": [],
                    "count": unclustered_row_count,
                    "share": 0.0,
                    "confidence": round(float(np.mean(confidences[unclustered_indices])), 4),
                    "sampleQuotes": sample_quotes,
                    "sentimentBreakdown": average_sentiment_breakdown(unclustered_rows),
                    "rowIds": [row["id"] for row in unclustered_rows],
                    "source": "system",
                    "diagnostics": {
                        "uniqueCommentCount": len(unclustered_indices),
                        "lowConfidenceRowCount": len(unclustered_rows),
                    },
                }
            )
    else:
        clustering_method = "no clusterable comments"

    analyzed_rows = sum(theme["count"] for theme in themes)
    clustered_rows = sum(theme["count"] for theme in themes if theme["kind"] == "cluster")
    low_confidence_rows = sum(
        1
        for row in evidence_rows
        if row["assignmentType"] == "unclustered"
        or (
            row["assignmentType"] == "clustered"
            and row["assignmentConfidence"] is not None
            and row["assignmentConfidence"] < LOW_CONFIDENCE_THRESHOLD
        )
    )

    if analyzed_rows > 0:
        for theme in themes:
            theme["share"] = theme["count"] / analyzed_rows

    cluster_confidences = [theme["confidence"] for theme in themes if theme["kind"] == "cluster" and theme["confidence"] is not None]
    average_theme_confidence = round(average(cluster_confidences), 4) if cluster_confidences else None

    evidence_rows.sort(key=lambda row: row["rowNumber"])
    themes.sort(key=lambda theme: (theme["kind"] == "unclustered", -theme["count"]))

    summary = {
        "fileName": payload.fileName,
        "sheetName": payload.sheetName,
        "totalRows": payload.totalRows,
        "usableRows": usable_rows,
        "analyzedRows": analyzed_rows,
        "uniqueRows": unique_rows,
        "removedEmptyRows": removed_empty_rows,
        "duplicateRows": duplicate_rows,
        "sampledOutRows": 0,
        "textColumn": payload.textColumn,
        "metadataColumns": payload.metadataColumns,
        "languageHint": payload.languageHint,
        "engine": f"OpenAI embeddings + PCA + {clustering_method}",
        "notes": summarize_notes(
            excluded_short_rows,
            excluded_taglike_rows,
            unclustered_row_count,
            reassigned_noise_rows,
            used_fallback_clustering,
        ),
        "diagnostics": {
            "clusteringMethod": clustering_method,
            "embeddingModel": EMBEDDING_MODEL,
            "labelingModel": LABELING_MODEL,
            "usedFallbackClustering": used_fallback_clustering,
            "clusterCount": cluster_count,
            "clusteredRows": clustered_rows,
            "unclusteredRows": unclustered_row_count,
            "excludedShortRows": excluded_short_rows,
            "excludedTagLikeRows": excluded_taglike_rows,
            "lowConfidenceRows": low_confidence_rows,
            "noiseRatio": round(unclustered_row_count / max(analyzed_rows, 1), 4),
            "averageThemeConfidence": average_theme_confidence,
            "reassignedNoiseRows": reassigned_noise_rows,
        },
    }

    return {
        "summary": summary,
        "themes": themes,
        "rows": evidence_rows,
        "metadataValueCounts": build_metadata_value_counts(
            [row for row in evidence_rows if row["themeId"] is not None],
            payload.metadataColumns,
        ),
        "report": build_report(summary, themes),
        "generatedAt": datetime.utcnow().isoformat() + "Z",
    }


@app.post("/")
@app.post("/api/python_analyze")
def python_analyze(payload: AnalysisPayload) -> dict[str, Any]:
    try:
        return analyze_payload(payload)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
