fetch("http://127.0.0.1:5002/predict", {
  method: "POST",
  body: formData
})
.then(res => res.json())
.then(data => console.log(data));
