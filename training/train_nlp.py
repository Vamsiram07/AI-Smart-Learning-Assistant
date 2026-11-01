import pandas as pd
import joblib
import os

from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report


# Dataset paths
DATASET_PATH = "datasets/nlp"
MODEL_PATH = "models/nlp"

os.makedirs(MODEL_PATH, exist_ok=True)


def load_dataset(filename):
    path = os.path.join(DATASET_PATH, filename)
    return pd.read_parquet(path)


def prepare_data(df):
    texts = []
    labels = []
    groups = []

    for index, row in df.iterrows():

        question = str(row["question"])
        support = str(row["support"])

        correct = str(row["correct_answer"])

        options = [
            row["distractor1"],
            row["distractor2"],
            row["distractor3"],
            correct
        ]

        for option in options:
            if pd.isna(option):
                continue

            option = str(option).strip()

            if not option:
                continue

            text = (
                "Question: " + question +
                " Context: " + support +
                " Answer: " + option
            )

            texts.append(text)
            labels.append(1 if option == correct else 0)
            groups.append(index)

    return texts, labels, groups


def evaluate_model(model, df, name):

    X, y, groups = prepare_data(df)

    probabilities = model.predict_proba(X)[:, 1]

    results = pd.DataFrame({
        "group": groups,
        "label": y,
        "score": probabilities
    })

    correct = 0
    total = 0

    for _, group in results.groupby("group"):

        predicted = group.loc[group["score"].idxmax(), "label"]

        if predicted == 1:
            correct += 1

        total += 1

    accuracy = correct / total if total else 0

    print(f"\n{name} Accuracy: {accuracy * 100:.2f}%")
    print(f"{name} Questions Tested: {total}")

    return accuracy


# Load datasets
print("Loading SciQ dataset...")

train_df = load_dataset("train-00000-of-00001.parquet")
validation_df = load_dataset("validation-00000-of-00001.parquet")
test_df = load_dataset("test-00000-of-00001.parquet")


# Prepare training data
print("\nPreparing training data...")

X_train, y_train, _ = prepare_data(train_df)

print("Training examples:", len(X_train))


# Create NLP model
print("\nCreating NLP model...")

model = Pipeline([
    (
        "tfidf",
        TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=50000,
            min_df=2,
            sublinear_tf=True
        )
    ),
    (
        "classifier",
        LogisticRegression(
            max_iter=200,
            solver="liblinear",
            random_state=42
        )
    )
])


# Train model
print("\nTraining started...")

model.fit(X_train, y_train)

print("Training completed!")


# Evaluate model
evaluate_model(model, validation_df, "Validation")
evaluate_model(model, test_df, "Test")


# Save trained model
model_file = os.path.join(
    MODEL_PATH,
    "sciq_qa_model.joblib"
)

joblib.dump(model, model_file)

print("\nModel saved successfully!")
print("Location:", model_file)
print("\nLearnSphere NLP training completed!")