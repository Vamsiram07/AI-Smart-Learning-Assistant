
import os
import torch
import torch.nn as nn
import torch.optim as optim

from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms


# 1. Device configuration
device = torch.device("cpu")
print("Using device:", device)


# 2. Dataset transformations
transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize(
        (0.4914, 0.4822, 0.4465),
        (0.2470, 0.2435, 0.2616)
    )
])


# 3. Load CIFAR-10 dataset
train_dataset = datasets.CIFAR10(
    root="datasets/cv",
    train=True,
    download=False,
    transform=transform
)

test_dataset = datasets.CIFAR10(
    root="datasets/cv",
    train=False,
    download=False,
    transform=transform
)

# Split training data into training and validation
train_size = 45000
validation_size = 5000

train_subset, validation_subset = random_split(
    train_dataset,
    [train_size, validation_size],
    generator=torch.Generator().manual_seed(42)
)

train_loader = DataLoader(
    train_subset, batch_size=128, shuffle=True, num_workers=0
)

validation_loader = DataLoader(
    validation_subset, batch_size=128, shuffle=False, num_workers=0
)

test_loader = DataLoader(
    test_dataset, batch_size=128, shuffle=False, num_workers=0
)

classes = train_dataset.classes

print("Training images:", len(train_subset))
print("Validation images:", len(validation_subset))
print("Testing images:", len(test_dataset))


# 4. Build CNN model
class CNN(nn.Module):

    def __init__(self):
        super(CNN, self).__init__()

        self.features = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2)
        )

        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128 * 4 * 4, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, 10)
        )

    def forward(self, x):
        x = self.features(x)
        x = self.classifier(x)
        return x


model = CNN().to(device)

criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)


# 5. Training function
def evaluate(loader):
    model.eval()
    correct = 0
    total = 0
    total_loss = 0

    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            labels = labels.to(device)

            outputs = model(images)
            loss = criterion(outputs, labels)

            total_loss += loss.item()
            _, predicted = torch.max(outputs, 1)

            total += labels.size(0)
            correct += (predicted == labels).sum().item()

    accuracy = 100 * correct / total
    average_loss = total_loss / len(loader)

    return average_loss, accuracy


# 6. Train the CNN model
epochs = 5
best_accuracy = 0

os.makedirs("models/cv", exist_ok=True)

for epoch in range(epochs):

    model.train()
    running_loss = 0

    for batch_index, (images, labels) in enumerate(train_loader):

        images = images.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()

        outputs = model(images)
        loss = criterion(outputs, labels)

        loss.backward()
        optimizer.step()

        running_loss += loss.item()

    train_loss = running_loss / len(train_loader)

    validation_loss, validation_accuracy = evaluate(
        validation_loader
    )

    print(f"\nEpoch [{epoch + 1}/{epochs}]")
    print(f"Training Loss: {train_loss:.4f}")
    print(f"Validation Loss: {validation_loss:.4f}")
    print(f"Validation Accuracy: {validation_accuracy:.2f}%")

    if validation_accuracy > best_accuracy:
        best_accuracy = validation_accuracy

        torch.save(
            model.state_dict(),
            "models/cv/cifar10_cnn.pth"
        )

        print("Best model saved!")


# 7. Test the trained model
model.load_state_dict(
    torch.load("models/cv/cifar10_cnn.pth", map_location=device)
)

test_loss, test_accuracy = evaluate(test_loader)

print("\n========== FINAL RESULTS ==========")
print(f"Test Loss: {test_loss:.4f}")
print(f"Test Accuracy: {test_accuracy:.2f}%")
print("Model saved at: models/cv/cifar10_cnn.pth")
print("CNN training completed successfully!")
