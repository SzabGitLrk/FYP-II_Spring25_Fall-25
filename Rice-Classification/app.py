from flask import Flask, render_template, request
from ultralytics import YOLO
import os

app = Flask(__name__)

# Where uploaded images will be saved
UPLOAD_FOLDER = "static/uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Load YOLO classification model
model = YOLO("/Users/macbookpro/Desktop/Final Year Project/train15/weights/best.pt")

@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        if "file" not in request.files:
            return render_template("index.html", result="No file uploaded")

        file = request.files["file"]
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(file_path)

        # Run YOLO classification
        results = model.predict(file_path)
        pred_class = results[0].probs.top1
        class_name = results[0].names[pred_class]

        # Confidence %
        confidence = float(results[0].probs.top1conf * 100)

        return render_template(
            "index.html",
            result=class_name,
            confidence=int(confidence),
            file_path="/" + file_path
        )

    return render_template("index.html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=True)
