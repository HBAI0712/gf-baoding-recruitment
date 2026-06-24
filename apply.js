(function () {
  const data = window.RECRUITMENT_SITE_DATA || {};
  const form = document.getElementById("applicationForm");
  const message = document.getElementById("formMessage");
  const fileInput = form ? form.querySelector('input[name="resume"]') : null;
  const fileHint = document.getElementById("fileHint");
  const uploadBox = document.getElementById("uploadBox");
  const positionSelect = document.getElementById("positionSelect");
  const pageProgress = document.getElementById("pageProgress");
  const formProgressText = document.getElementById("formProgressText");
  const formProgressBar = document.getElementById("formProgressBar");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const root = document.documentElement;
  let pointerFrame = null;
  let latestPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  function text(selector, value) {
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = value || "";
    });
  }

  function setMessage(value, type) {
    if (!message) return;
    message.textContent = value;
    message.classList.remove("is-error", "is-success");
    if (type) message.classList.add(type);
  }

  function updatePageProgress() {
    if (!pageProgress) return;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? Math.min(window.scrollY / maxScroll, 1) : 0;
    pageProgress.style.transform = `scaleX(${progress})`;
    root.style.setProperty("--scroll-ratio", progress.toFixed(4));
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function installPointerLight() {
    if (reducedMotion || !finePointer) return;
    const glow = document.createElement("div");
    glow.className = "ambient-spotlight";
    glow.setAttribute("aria-hidden", "true");
    document.body.appendChild(glow);

    window.addEventListener(
      "pointermove",
      (event) => {
        latestPointer = { x: event.clientX, y: event.clientY };
        if (pointerFrame) return;
        pointerFrame = window.requestAnimationFrame(() => {
          root.style.setProperty("--cursor-x", `${latestPointer.x}px`);
          root.style.setProperty("--cursor-y", `${latestPointer.y}px`);
          pointerFrame = null;
        });
      },
      { passive: true }
    );
  }

  function installSurfaceMotion() {
    if (reducedMotion || !finePointer) return;
    document
      .querySelectorAll(".apply-contact-card, .application-form, .application-aside, .upload-box")
      .forEach((surface) => {
        surface.classList.add("interactive-surface");
        surface.addEventListener(
          "pointermove",
          (event) => {
            const rect = surface.getBoundingClientRect();
            const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
            const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
            surface.style.setProperty("--mx", `${x}%`);
            surface.style.setProperty("--my", `${y}%`);
          },
          { passive: true }
        );
        surface.addEventListener("pointerleave", () => {
          surface.style.setProperty("--mx", "50%");
          surface.style.setProperty("--my", "50%");
        });
      });
  }

  function isControlComplete(control) {
    if (control.disabled) return true;
    if (control.type === "checkbox") return control.checked;
    if (control.type === "file") return Boolean(control.files && control.files.length);
    return Boolean(String(control.value || "").trim());
  }

  function updateFormProgress() {
    if (!form || !formProgressText || !formProgressBar) return;
    const requiredControls = Array.from(form.querySelectorAll("[required]"));
    const completed = requiredControls.filter(isControlComplete).length;
    const total = requiredControls.length || 1;
    const progress = Math.round((completed / total) * 100);
    formProgressText.textContent = `申请信息完成 ${completed}/${total}`;
    formProgressBar.style.transform = `scaleX(${progress / 100})`;
  }

  window.addEventListener("scroll", updatePageProgress, { passive: true });
  updatePageProgress();
  installPointerLight();

  text('[data-field="branchName"]', data.branchName);
  text('[data-field="complianceNote"]', data.complianceNote);
  Object.entries(data.contact || {}).forEach(([key, value]) => {
    text(`[data-contact="${key}"]`, value);
  });

  const phoneLink = document.querySelector('[data-contact-link="phone"]');
  if (phoneLink && data.contact && data.contact.phone) {
    phoneLink.href = `tel:${String(data.contact.phone).replace(/[^\d+]/g, "")}`;
  }

  const emailLink = document.querySelector('[data-contact-link="email"]');
  if (emailLink && data.contact && data.contact.email) {
    emailLink.href = `mailto:${data.contact.email}`;
  }

  if (positionSelect) {
    const activePositions = (data.positions || []).filter((position) => position.isActive !== false);
    if (!activePositions.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = data.noJobsTitle || "当前暂无在招岗位";
      positionSelect.appendChild(option);
      positionSelect.disabled = true;
      const submitButton = form && form.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "暂无可投递岗位";
      }
      setMessage(data.noJobsText || "当前暂无在招岗位，暂不开放在线投递。", "is-error");
      updateFormProgress();
      return;
    }
    activePositions.forEach((position) => {
      const option = document.createElement("option");
      option.value = position.title || "";
      option.textContent = position.title || "";
      positionSelect.appendChild(option);
    });
  }

  if (fileHint && data.resumeMaxSizeMB) {
    fileHint.textContent = `支持 PDF / DOC / DOCX，建议不超过 ${data.resumeMaxSizeMB}MB`;
  }

  function validateFile(file) {
    if (!file) return "请上传简历文件。";
    const allowed = [".pdf", ".doc", ".docx"];
    const lowerName = file.name.toLowerCase();
    if (!allowed.some((ext) => lowerName.endsWith(ext))) {
      return "简历仅支持 PDF、DOC、DOCX 格式。";
    }
    const maxMB = Number(data.resumeMaxSizeMB || 12);
    if (file.size > maxMB * 1024 * 1024) {
      return `简历文件请控制在 ${maxMB}MB 以内。`;
    }
    return "";
  }

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (file && fileHint) {
        fileHint.textContent = `已选择：${file.name}`;
        uploadBox && uploadBox.classList.add("has-file");
        const fileError = validateFile(file);
        setMessage(fileError, fileError ? "is-error" : "");
      }
      updateFormProgress();
    });
  }

  if (uploadBox && fileInput) {
    ["dragenter", "dragover"].forEach((eventName) => {
      uploadBox.addEventListener(eventName, (event) => {
        event.preventDefault();
        uploadBox.classList.add("is-dragging");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      uploadBox.addEventListener(eventName, (event) => {
        event.preventDefault();
        uploadBox.classList.remove("is-dragging");
      });
    });
    uploadBox.addEventListener("drop", (event) => {
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (!file) return;
      try {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        fileInput.files = transfer.files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (error) {
        setMessage("当前浏览器不支持拖拽写入，请点击上传简历文件。", "is-error");
      }
    });
  }

  function validPhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone.replace(/\s/g, ""));
  }

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setMessage("", "");

      const endpoint = data.applyEndpoint;
      const formData = new FormData(form);
      const phone = String(formData.get("phone") || "").trim();
      const file = fileInput && fileInput.files ? fileInput.files[0] : null;

      if (!validPhone(phone)) {
        setMessage("请填写正确的 11 位手机号码。", "is-error");
        return;
      }

      const fileError = validateFile(file);
      if (fileError) {
        setMessage(fileError, "is-error");
        return;
      }

      if (!endpoint) {
        setMessage("当前未配置后台接口，无法自动发送邮件。请先部署 server 文件夹中的后端服务。", "is-error");
        return;
      }

      if (location.protocol === "file:" && endpoint.startsWith("/")) {
        setMessage("当前是本地预览，无法直接发邮件。上线时请部署后端服务，或把 applyEndpoint 改成完整接口地址。", "is-error");
        return;
      }

      formData.append("branchName", data.branchName || "");
      formData.append("recipient", (data.contact && data.contact.email) || "");
      formData.append("submittedAt", new Date().toISOString());

      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "提交中...";
      }

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          body: formData
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.message || "提交失败，请稍后再试。");
        }
        form.reset();
        uploadBox && uploadBox.classList.remove("has-file");
        if (fileHint) {
          fileHint.textContent = `支持 PDF / DOC / DOCX，建议不超过 ${data.resumeMaxSizeMB || 12}MB`;
        }
        setMessage("提交成功，招聘负责人将根据岗位匹配情况与您联系。", "is-success");
      } catch (error) {
        setMessage(error.message || "提交失败，请稍后再试。", "is-error");
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "提交申请";
        }
        updateFormProgress();
      }
    });

    form.addEventListener("input", updateFormProgress);
    form.addEventListener("change", updateFormProgress);
    updateFormProgress();
  }

  installSurfaceMotion();
})();
