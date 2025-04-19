fetch("/api/has-attempted")
  .then(res => res.json())
  .then(data => {
    const alreadyAttempted = data.attempted;

    fetch("/api/daily-question")
      .then(res => res.json())
      .then(trivia => {
        const questionEl = document.getElementById("question");
        const optionsEl = document.getElementById("options");
        const resultEl = document.getElementById("result");

        questionEl.textContent = trivia.question;
        const options = [trivia.option1, trivia.option2, trivia.option3, trivia.option4];

        optionsEl.innerHTML = "";
        resultEl.textContent = "";

        options.forEach(option => {
          const btn = document.createElement("button");
          btn.textContent = option;

          if (alreadyAttempted) {
            btn.disabled = true;
            btn.style.opacity = "0.6";
            btn.style.cursor = "not-allowed";

            // Highlight the correct answer
            if (option === trivia.answer) {
              btn.style.border = "2px solid #28a745";
              btn.style.backgroundColor = "rgba(40, 167, 69, 0.2)";
            }

            resultEl.textContent = "⚠️ You’ve already attempted today’s question.";
            resultEl.style.color = "#ffc107";
          } else {
            btn.onclick = () => {
              // Disable all buttons after selection
              document.querySelectorAll(".options button").forEach(b => {
                b.disabled = true;
                b.style.opacity = "0.6";
                b.style.cursor = "not-allowed";
              });

              const isCorrect = option === trivia.answer;
              resultEl.textContent = isCorrect ? "✅ Correct!" : "❌ Wrong!";
              resultEl.style.color = isCorrect ? "#28a745" : "#dc3545";

              // Highlight the correct answer
              document.querySelectorAll(".options button").forEach(b => {
                if (b.textContent === trivia.answer) {
                  b.style.border = "2px solid #28a745";
                  b.style.backgroundColor = "rgba(40, 167, 69, 0.2)";
                }
              });

              // Submit the attempt to the server
              fetch("/api/submit-daily", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  question_id: trivia.id,
                  selected_option: option
                })
              })
              .then(res => res.json())
              .then(data => {
                if (data.correct) {
                  console.log("Correct answer submitted");
                } else {
                  console.log("Wrong answer submitted");
                }
              })
              .catch(err => {
                console.error("Error in submission:", err);
              });
            };
          }

          optionsEl.appendChild(btn);
        });
      });
  });
