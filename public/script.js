fetch("/api/question")
  .then(res => res.json())
  .then(trivia => {
    const questionEl = document.getElementById("question");
    const optionsEl = document.getElementById("options");
    const resultEl = document.getElementById("result");

    let answered = false;

    questionEl.textContent = trivia.question;
    const options = [trivia.option1, trivia.option2, trivia.option3, trivia.option4];

    optionsEl.innerHTML = ""; // Clear existing options
    resultEl.textContent = "";

    options.forEach(option => {
      const btn = document.createElement("button");
      btn.textContent = option;

      btn.onclick = () => {
        if (answered) return;
        answered = true;

        if (option === trivia.answer) {
          resultEl.textContent = "✅ Correct!";
          resultEl.style.color = "#28a745";
        } else {
          resultEl.textContent = "❌ Wrong!";
          resultEl.style.color = "#dc3545";
        }

        document.querySelectorAll(".options button").forEach(b => {
          b.disabled = true;
          b.style.opacity = "0.6";
          b.style.cursor = "not-allowed";

          if (b.textContent === trivia.answer) {
            b.style.border = "2px solid #28a745";
            b.style.backgroundColor = "rgba(40, 167, 69, 0.2)";
          }
        });
      };

      optionsEl.appendChild(btn);
    });
  });
