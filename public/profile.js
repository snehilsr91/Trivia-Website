function logout() {
    fetch("/api/logout").then(() => window.location.href = "login.html");
  }
  
  function toggleEdit() {
    document.getElementById("edit-form").classList.toggle("hidden");
  }
  
  function saveUserInfo() {
    const email = document.getElementById("edit-email").value;
    const description = document.getElementById("edit-description").value;
    const avatarFile = document.getElementById("avatarUpload").files[0];
  
    const formData = new FormData();
    formData.append("email", email);
    formData.append("description", description);
    if (avatarFile) formData.append("avatar", avatarFile);
  
    fetch("/api/update-user-info", {
      method: "POST",
      body: formData
    }).then(() => location.reload());
  }
  
  // Load profile data
  fetch("/api/user-profile")
    .then(res => res.json())
    .then(data => {
      const avatarImg = document.getElementById("avatar");

      if (data.avatar_url?.trim()) {
        avatarImg.src = data.avatar_url;
      } else {
        avatarImg.src = "default-avatar.png";
      }

      avatarImg.onerror = () => {
        avatarImg.src = "default-avatar.png"; // fallback if broken link
      };

      document.getElementById("email").textContent = data.email || "Not set";
      document.getElementById("description").textContent = data.description || "No description";
      document.getElementById("edit-email").value = data.email || "";
      document.getElementById("edit-description").value = data.description || "";

      document.getElementById("total").textContent = data.total_answered;
      document.getElementById("correct").textContent = data.correct_answers;
      document.getElementById("streak").textContent = data.streak;
    });

  