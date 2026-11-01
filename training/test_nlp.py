import joblib

model = joblib.load("models/nlp/sciq_qa_model.joblib")

question = "What is the process by which plants make food?"
context = "Plants use sunlight, water and carbon dioxide to produce glucose through photosynthesis."

options = [
    "Respiration",
    "Photosynthesis",
    "Digestion",
    "Fermentation"
]

print("\nLearnSphere NLP Model Test\n")

scores = []

for option in options:
    text = (
        f"Question: {question} "
        f"Context: {context} "
        f"Answer: {option}"
    )

    score = model.predict_proba([text])[0][1]
    scores.append((option, score))

scores.sort(key=lambda x: x[1], reverse=True)

print("Question:", question)
print("\nPredicted answers:")

for option, score in scores:
    print(f"{option}: {score:.4f}")

print("\nPredicted Answer:", scores[0][0])