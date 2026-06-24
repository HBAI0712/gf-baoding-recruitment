(function () {
  const data = window.RECRUITMENT_SITE_DATA || {};

  function text(selector, value) {
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = value || "";
    });
  }

  function escapeText(value) {
    return String(value || "");
  }

  text('[data-field="branchName"]', data.branchName);
  text('[data-field="campaignName"]', data.campaignName);
  text('[data-field="heroTitle"]', data.heroTitle);
  text('[data-field="heroSubtitle"]', data.heroSubtitle);
  text('[data-field="heroLead"]', data.heroLead);
  text('[data-field="primaryActionText"]', data.primaryActionText);
  text('[data-field="secondaryActionText"]', data.secondaryActionText);
  text('[data-field="floatingContactText"]', data.floatingContactText);
  text('[data-field="complianceNote"]', data.complianceNote);
  text("#managerQuote", data.managerQuote);

  if (data.branchName && data.campaignName) {
    document.title = `${data.branchName}${data.campaignName}`;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const pageProgress = document.getElementById("pageProgress");
  const navLinks = Array.from(document.querySelectorAll('.nav a[href^="#"]'));
  const root = document.documentElement;
  let pointerFrame = null;
  let latestPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  function updatePageProgress() {
    if (!pageProgress) return;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? Math.min(window.scrollY / maxScroll, 1) : 0;
    pageProgress.style.transform = `scaleX(${progress})`;
    root.style.setProperty("--scroll-ratio", progress.toFixed(4));
  }

  function updateActiveNav() {
    if (!navLinks.length) return;
    const offset = window.scrollY + 130;
    let currentLink = null;
    navLinks.forEach((link) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (target && target.offsetTop <= offset) currentLink = link;
    });
    navLinks.forEach((link) => {
      const isActive = link === currentLink;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  window.addEventListener(
    "scroll",
    () => {
      updatePageProgress();
      updateActiveNav();
    },
    { passive: true }
  );
  updatePageProgress();
  updateActiveNav();

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
    const surfaces = document.querySelectorAll(
      ".hero-media, .platform-card, .position-card, .number-item, .fact, .benefit-tag, .process-panel, .requirement-panel, .apply-card"
    );
    surfaces.forEach((surface) => {
      surface.classList.add("interactive-surface");
      surface.addEventListener(
        "pointermove",
        (event) => {
          const rect = surface.getBoundingClientRect();
          const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
          const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
          surface.style.setProperty("--mx", `${x}%`);
          surface.style.setProperty("--my", `${y}%`);

          if (surface.classList.contains("hero-media") || surface.classList.contains("position-card")) {
            const rotateY = ((x - 50) / 50) * 4;
            const rotateX = -((y - 50) / 50) * 4;
            surface.style.setProperty("--tilt-x", `${rotateX.toFixed(2)}deg`);
            surface.style.setProperty("--tilt-y", `${rotateY.toFixed(2)}deg`);
          }
        },
        { passive: true }
      );
      surface.addEventListener("pointerleave", () => {
        surface.style.setProperty("--mx", "50%");
        surface.style.setProperty("--my", "50%");
        surface.style.setProperty("--tilt-x", "0deg");
        surface.style.setProperty("--tilt-y", "0deg");
      });
    });
  }

  function updateProcessProgress() {
    document.querySelectorAll(".process-list").forEach((list) => {
      const rect = list.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const progress = clamp((viewport * 0.72 - rect.top) / Math.max(rect.height, 1), 0, 1);
      list.style.setProperty("--process-progress", progress.toFixed(3));
    });
  }

  window.addEventListener("scroll", updateProcessProgress, { passive: true });
  window.addEventListener("resize", updateProcessProgress);
  installPointerLight();

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

  const highlights = document.getElementById("highlights");
  const activePositions = (data.positions || []).filter((position) => position.isActive !== false);
  document.body.classList.toggle("no-open-positions", activePositions.length === 0);
  if (!activePositions.length) {
    document.querySelectorAll('a[href="./apply.html"]').forEach((link) => {
      link.href = "#positions";
      link.classList.add("is-disabled");
      if (link.textContent.trim()) link.textContent = "查看招聘状态";
    });
  }
  if (highlights) {
    highlights.innerHTML = "";
    (data.highlights || []).forEach((item) => {
      const article = document.createElement("article");
      article.className = "fact";
      article.innerHTML = `<strong></strong><span></span>`;
      article.querySelector("strong").textContent = escapeText(item.label);
      article.querySelector("span").textContent = escapeText(item.text);
      highlights.appendChild(article);
    });
  }

  const numberStrip = document.getElementById("numberStrip");
  if (numberStrip) {
    numberStrip.innerHTML = "";
    [
      { value: String(activePositions.length), label: "当前在招岗位" },
      { value: String((data.benefits || []).length), label: "福利支持项" },
      { value: data.process && data.process.length ? String(data.process.length) : "4", label: "应聘流程节点" }
    ].forEach((item) => {
      const article = document.createElement("article");
      article.className = "number-item";
      const value = document.createElement("strong");
      value.dataset.countTo = escapeText(item.value);
      value.textContent = reducedMotion ? escapeText(item.value) : "0";
      const label = document.createElement("span");
      label.textContent = escapeText(item.label);
      article.append(value, label);
      numberStrip.appendChild(article);
    });
  }

  function animateNumber(node) {
    const target = Number(node.dataset.countTo || 0);
    if (!Number.isFinite(target)) {
      node.textContent = node.dataset.countTo || "";
      return;
    }
    const duration = 900;
    const startTime = performance.now();
    const step = (time) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = String(Math.round(target * eased));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        node.textContent = String(target);
      }
    };
    window.requestAnimationFrame(step);
  }

  const positionGrid = document.getElementById("positionGrid");
  const modal = document.getElementById("positionModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalIntro = document.getElementById("modalIntro");
  const modalDuties = document.getElementById("modalDuties");
  const modalRequirements = document.getElementById("modalRequirements");
  const modalPanel = modal && modal.querySelector(".position-modal");
  let lastFocusedElement = null;

  function positionCards() {
    return document.querySelectorAll(".position-card");
  }

  function openPositionModal(position) {
    if (!modal) return;
    lastFocusedElement = document.activeElement;
    modalTitle.textContent = escapeText(position.title);
    modalIntro.textContent = escapeText(position.intro);
    modalDuties.innerHTML = "";
    (position.duties || []).forEach((duty) => {
      const li = document.createElement("li");
      li.textContent = escapeText(duty);
      modalDuties.appendChild(li);
    });
    modalRequirements.innerHTML = "";
    (data.requirements || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = escapeText(item);
      modalRequirements.appendChild(li);
    });
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    window.requestAnimationFrame(() => {
      (modalPanel || modal.querySelector(".modal-close"))?.focus();
    });
  }

  function closePositionModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    positionCards().forEach((card) => card.setAttribute("aria-expanded", "false"));
    if (lastFocusedElement && document.body.contains(lastFocusedElement)) {
      lastFocusedElement.focus();
    }
  }

  function trapModalFocus(event) {
    if (!modal || !modal.classList.contains("is-open") || event.key !== "Tab") return;
    const focusable = modal.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!modal.contains(document.activeElement) || document.activeElement === modalPanel) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (positionGrid) {
    positionGrid.innerHTML = "";
    if (!activePositions.length) {
      const empty = document.createElement("article");
      empty.className = "empty-state";
      const title = document.createElement("h3");
      title.textContent = data.noJobsTitle || "当前暂无在招岗位";
      const intro = document.createElement("p");
      intro.textContent =
        data.noJobsText || "后续招聘计划开启后，本页面会第一时间更新岗位信息。";
      empty.append(title, intro);
      positionGrid.appendChild(empty);
    }

    activePositions.forEach((position) => {
      const article = document.createElement("button");
      article.type = "button";
      article.className = "position-card";
      article.setAttribute("aria-haspopup", "dialog");
      article.setAttribute("aria-expanded", "false");

      const top = document.createElement("span");
      top.className = "card-top";
      const title = document.createElement("span");
      title.className = "position-title";
      title.textContent = escapeText(position.title);
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = escapeText(position.tag);
      top.append(title, tag);

      const intro = document.createElement("span");
      intro.className = "position-summary";
      intro.textContent = escapeText(position.intro);

      const more = document.createElement("span");
      more.className = "card-more";
      more.textContent = "查看岗位详情";

      article.append(top, intro, more);
      article.addEventListener("click", () => {
        document
          .querySelectorAll(".position-card")
          .forEach((card) => {
            card.classList.remove("is-active");
            card.setAttribute("aria-expanded", "false");
          });
        article.classList.add("is-active");
        article.setAttribute("aria-expanded", "true");
        openPositionModal(position);
      });
      positionGrid.appendChild(article);
    });
    const firstCard = positionGrid.querySelector(".position-card");
    if (firstCard) firstCard.classList.add("is-active");
  }

  document.querySelectorAll(".modal-close, .modal-close-secondary").forEach((button) => {
    button.addEventListener("click", closePositionModal);
  });
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closePositionModal();
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePositionModal();
    trapModalFocus(event);
  });

  const requirementList = document.getElementById("requirementList");
  if (requirementList) {
    requirementList.innerHTML = "";
    (data.requirements || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = escapeText(item);
      requirementList.appendChild(li);
    });
  }

  const benefitTags = document.getElementById("benefitTags");
  if (benefitTags) {
    benefitTags.innerHTML = "";
    (data.benefits || []).forEach((item) => {
      const span = document.createElement("span");
      span.className = "benefit-tag";
      span.style.setProperty("--i", benefitTags.children.length);
      const label = document.createElement("span");
      label.textContent = escapeText(item);
      span.appendChild(label);
      benefitTags.appendChild(span);
    });
  }

  const processList = document.getElementById("processList");
  if (processList) {
    processList.innerHTML = "";
    (data.process || []).forEach((item) => {
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      strong.textContent = escapeText(item.step);
      const span = document.createElement("span");
      span.textContent = escapeText(item.text);
      li.append(strong, span);
      processList.appendChild(li);
    });
  }

  installSurfaceMotion();
  updateProcessProgress();

  const revealItems = document.querySelectorAll(".reveal");
  revealItems.forEach((item, index) => {
    item.style.setProperty("--reveal-delay", `${Math.min(index * 80, 320)}ms`);
  });
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("in-view"));
  }

  if (numberStrip && !reducedMotion && "IntersectionObserver" in window) {
    const numberObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target
            .querySelectorAll("[data-count-to]")
            .forEach((node) => animateNumber(node));
          numberObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.35 }
    );
    numberObserver.observe(numberStrip);
  } else if (numberStrip) {
    numberStrip.querySelectorAll("[data-count-to]").forEach((node) => {
      node.textContent = node.dataset.countTo || "";
    });
  }
})();
