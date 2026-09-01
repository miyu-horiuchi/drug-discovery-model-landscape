(function () {
  "use strict";

  const modelTabs = Array.from(document.querySelectorAll("[data-model]"));
  const modelPanels = Array.from(document.querySelectorAll("[data-model-panel]"));
  const experienceTabs = Array.from(document.querySelectorAll(".experience-tabs [role='tab']"));
  const experiencePanels = Array.from(document.querySelectorAll("main > [role='tabpanel']"));
  const demoTabs = Array.from(document.querySelectorAll("[data-md-demo]"));
  const demoPanels = Array.from(document.querySelectorAll("[data-md-panel]"));
  const potentialTabs = Array.from(document.querySelectorAll("[data-potential-model]"));
  const potentialPanels = Array.from(document.querySelectorAll("[data-potential-panel]"));
  const pipelineStages = Array.from(document.querySelectorAll("[data-stage]"));
  const evidenceRows = Array.from(document.querySelectorAll("[data-value]"));
  const revealItems = Array.from(document.querySelectorAll("[data-reveal]"));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const canvas = document.querySelector("#atom-canvas");
  const context = canvas?.getContext("2d");
  const animationToggle = document.querySelector("#animation-toggle");
  let activeExperience = "drug-discovery";
  let activeDemo = "nanowire";
  let animationFrame = null;
  let pipelineFrame = null;
  let userPaused = false;
  let sceneStart = performance.now();

  function selectModel(modelId) {
    modelTabs.forEach((tab) => {
      const selected = tab.dataset.model === modelId;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    modelPanels.forEach((panel) => { panel.hidden = panel.dataset.modelPanel !== modelId; });
  }

  function activateStage(stageId) {
    document.body.dataset.activeStage = stageId;
    pipelineStages.forEach((stage) => {
      if (stage.dataset.stage === stageId) stage.setAttribute("aria-current", "step");
      else stage.removeAttribute("aria-current");
    });
  }

  function updatePipelineFromScroll() {
    const pipeline = document.querySelector("#pipeline");
    if (!pipeline || !pipelineStages.length || pipeline.offsetParent === null) return;
    const rect = pipeline.getBoundingClientRect();
    const travel = Math.max(pipeline.offsetHeight - window.innerHeight, 1);
    const progress = Math.min(0.999, Math.max(0, -rect.top / travel));
    activateStage(pipelineStages[Math.floor(progress * pipelineStages.length)].dataset.stage);
  }

  function schedulePipelineUpdate() {
    if (pipelineFrame !== null) return;
    pipelineFrame = requestAnimationFrame(() => {
      pipelineFrame = null;
      updatePipelineFromScroll();
    });
  }

  function setEvidenceProgress(element) {
    const value = Math.min(100, Math.max(0, Number(element.dataset.value) || 0));
    element.style.setProperty("--progress", `${value}%`);
  }

  function moveTab(tabs, nextIndex) {
    const selected = tabs[(nextIndex + tabs.length) % tabs.length];
    selected.focus();
    return selected;
  }

  function bindTabset(tabs, selectFromTab) {
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", (event) => {
        if (tab.tagName === "A") event.preventDefault();
        selectFromTab(tab);
      });
      tab.addEventListener("keydown", (event) => {
        let nextIndex = null;
        if (event.key === "ArrowRight") nextIndex = index + 1;
        if (event.key === "ArrowLeft") nextIndex = index - 1;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = tabs.length - 1;
        if (nextIndex === null) return;
        event.preventDefault();
        selectFromTab(moveTab(tabs, nextIndex));
      });
    });
  }

  function selectExperience(panelId, updateHash = true) {
    const safeId = experiencePanels.some((panel) => panel.id === panelId) ? panelId : "drug-discovery";
    activeExperience = safeId;
    document.documentElement.classList.add("tabs-ready");
    experienceTabs.forEach((tab) => {
      const selected = tab.getAttribute("aria-controls") === safeId;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    experiencePanels.forEach((panel) => { panel.hidden = panel.id !== safeId; });
    document.title = safeId === "interatomic-potentials"
      ? "ML Interatomic Potentials · Computational Discovery Field Guide"
      : "Drug Discovery Models · Computational Discovery Field Guide";
    if (updateHash && window.location.hash !== `#${safeId}`) history.replaceState(null, "", `#${safeId}`);
    schedulePipelineUpdate();
    updateAnimationLifecycle();
  }

  const demoNames = {
    nanowire: "Gold nanowire · tensile strain",
    brazing: "Copper–nickel · thermal diffusion",
    impact: "Mineral surface · impact cascade",
    assembly: "Peptides · thermal self-assembly",
    catalysis: "N₂ + iron · surface dissociation",
  };

  function selectDemo(demoId) {
    activeDemo = demoTabs.some((tab) => tab.dataset.mdDemo === demoId) ? demoId : "nanowire";
    demoTabs.forEach((tab) => {
      const selected = tab.dataset.mdDemo === activeDemo;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    demoPanels.forEach((panel) => { panel.hidden = panel.dataset.mdPanel !== activeDemo; });
    const caption = document.querySelector("#demo-caption");
    if (caption) caption.textContent = demoNames[activeDemo];
    sceneStart = performance.now();
    drawScene(sceneStart);
    updateAnimationLifecycle();
  }

  function selectPotentialModel(modelId) {
    const safeId = potentialTabs.some((tab) => tab.dataset.potentialModel === modelId) ? modelId : "lj";
    potentialTabs.forEach((tab) => {
      const selected = tab.dataset.potentialModel === safeId;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    potentialPanels.forEach((panel) => { panel.hidden = panel.dataset.potentialPanel !== safeId; });
    document.querySelector(".architecture-viewer")?.setAttribute("data-active-architecture", safeId);
    const selectedPanel = potentialPanels.find((panel) => panel.dataset.potentialPanel === safeId);
    if (!selectedPanel) return;
    ["locality", "directionality", "universality"].forEach((indicator) => {
      const output = document.querySelector(`[data-indicator="${indicator}"]`);
      if (output) output.textContent = selectedPanel.dataset[indicator];
    });
    const pipeline = selectedPanel.dataset.pipeline.split("|");
    ["neighbor", "network", "output"].forEach((stage, index) => {
      const output = document.querySelector(`#arch-${stage}`);
      if (output) output.textContent = pipeline[index];
    });
  }

  function pairEnergy(r) {
    const inv6 = Math.pow(1 / r, 6);
    return 4 * (inv6 * inv6 - inv6);
  }

  function pairForce(r) {
    const inv7 = Math.pow(1 / r, 7);
    const inv13 = Math.pow(1 / r, 13);
    return 24 * (2 * inv13 - inv7);
  }

  function signed(value) {
    if (Math.abs(value) < 0.005) return "0.00";
    return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}`;
  }

  function updatePotential(distance) {
    const r = Math.min(2.2, Math.max(0.88, Number(distance)));
    const energy = pairEnergy(r);
    const force = pairForce(r);
    const markerX = 92 + ((r - 0.88) / 1.32) * 508;
    const markerY = Math.min(246, Math.max(42, 180 - energy * 42));
    const marker = document.querySelector("#potential-marker");
    marker?.querySelector("line")?.setAttribute("x1", markerX.toFixed(1));
    marker?.querySelector("line")?.setAttribute("x2", markerX.toFixed(1));
    marker?.querySelector("circle")?.setAttribute("cx", markerX.toFixed(1));
    marker?.querySelector("circle")?.setAttribute("cy", markerY.toFixed(1));
    document.querySelector("#distance-value").textContent = `${r.toFixed(2)} σ`;
    document.querySelector("#energy-value").textContent = `${signed(energy)} ε`;
    document.querySelector("#force-value").textContent = `${signed(force)} ε/σ`;
    document.querySelector("#force-direction").textContent = Math.abs(force) < 0.08 ? "Near equilibrium" : force > 0 ? "Repulsive" : "Attractive";
  }

  function updateManyBodyLab(thirdAtomX) {
    const x = Math.min(85, Math.max(15, Number(thirdAtomX)));
    const angle = Math.round(55 + ((x - 15) / 70) * 70);
    const correction = Math.pow((angle - 109.5) / 54.5, 2) * 0.8;
    document.querySelector("#third-atom")?.style.setProperty("--third-x", `${x}%`);
    document.querySelector("#angle-arc")?.style.setProperty("--angle", `${angle}deg`);
    document.querySelector("#third-position").textContent = `${Math.round(x)}%`;
    document.querySelector("#angle-value").textContent = `${angle}°`;
    document.querySelector("#many-body-value").textContent = `+${correction.toFixed(2)}`;
  }

  function atom(x, y, radius, color, label = "") {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    context.strokeStyle = "rgba(255,255,255,.35)";
    context.stroke();
    if (label) {
      context.fillStyle = "#07131c";
      context.font = "700 11px system-ui";
      context.textAlign = "center";
      context.fillText(label, x, y + 4);
    }
  }

  function bond(x1, y1, x2, y2, alpha = 0.35) {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.strokeStyle = `rgba(177, 209, 220, ${alpha})`;
    context.lineWidth = 2;
    context.stroke();
  }

  function drawScene(now) {
    if (!context || !canvas) return;
    const width = canvas.width;
    const height = canvas.height;
    const t = (now - sceneStart) / 1000;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#07131c";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(87,230,207,.08)";
    for (let x = 0; x < width; x += 48) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
    for (let y = 0; y < height; y += 48) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
    if (activeDemo === "nanowire") {
      const strain = 1 + 0.12 * Math.sin(t * 0.7);
      for (let row = 0; row < 5; row += 1) for (let col = 0; col < 13; col += 1) {
        const pinch = 1 - 0.42 * Math.exp(-Math.pow(col - 6, 2) / 4);
        const x = 145 + col * 55 * strain;
        const y = 112 + row * 48 + (row - 2) * (1 - pinch) * 35 + Math.sin(t * 2 + col) * 2;
        if (col > 0) bond(x - 55 * strain, y, x, y, 0.22);
        atom(x, y, 10, "#f2b84b", "Au");
      }
    } else if (activeDemo === "brazing") {
      for (let i = 0; i < 70; i += 1) {
        const baseX = 90 + (i % 14) * 58;
        const baseY = 68 + Math.floor(i / 14) * 70;
        const left = baseX < width / 2;
        atom(baseX + Math.sin(t * 0.7 + i * 13.17) * 12, baseY + Math.cos(t + i) * 5, 11, left ? "#57e6cf" : "#bb83ff", left ? "Cu" : "Ni");
      }
    } else if (activeDemo === "impact") {
      const phase = (t * 0.28) % 1;
      for (let i = 0; i < 54; i += 1) {
        const x = 180 + (i % 12) * 52;
        const y = 235 + Math.floor(i / 12) * 42 + Math.sin(i * 2) * 4;
        const kick = Math.max(0, 1 - Math.abs(x - 480) / 150) * phase * 70;
        atom(x + Math.sin(i) * kick, y + kick, 10, i % 4 ? "#57e6cf" : "#bb83ff");
      }
      atom(480, 20 + phase * 190, 22, "#f2b84b", "μ");
    } else if (activeDemo === "assembly") {
      for (let chain = 0; chain < 6; chain += 1) for (let i = 0; i < 8; i += 1) {
        const orbit = 118 - Math.min(75, t * 8);
        const angle = chain + i * 0.12 + t * 0.25;
        const x = 480 + Math.cos(angle) * orbit + (i - 3.5) * 18;
        const y = 210 + Math.sin(angle) * orbit * 0.55;
        if (i > 0) bond(x - 18, y, x, y, 0.45);
        atom(x, y, 9, i % 2 ? "#57e6cf" : "#bb83ff");
      }
    } else {
      for (let row = 0; row < 3; row += 1) for (let col = 0; col < 13; col += 1) atom(125 + col * 58, 270 + row * 45, 12, "#8798a2", "Fe");
      const approach = 90 + Math.min(150, (t * 30) % 210);
      const separation = Math.max(19, 19 + Math.sin(Math.min(1, approach / 210) * Math.PI / 2) * 25);
      bond(480 - separation, approach, 480 + separation, approach, 0.8);
      atom(480 - separation, approach, 15, "#57e6cf", "N");
      atom(480 + separation, approach, 15, "#57e6cf", "N");
    }
  }

  function animationLoop(now) {
    drawScene(now);
    animationFrame = requestAnimationFrame(animationLoop);
  }

  function shouldAnimate() {
    return activeExperience === "interatomic-potentials" && !userPaused && !document.hidden && !reducedMotion.matches;
  }

  function updateAnimationLifecycle() {
    if (shouldAnimate() && animationFrame === null) animationFrame = requestAnimationFrame(animationLoop);
    if (!shouldAnimate() && animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
      drawScene(sceneStart + 850);
    }
  }

  function setAnimationPaused(paused) {
    userPaused = Boolean(paused);
    if (animationToggle) {
      animationToggle.setAttribute("aria-pressed", String(userPaused));
      animationToggle.textContent = userPaused ? "Resume motion" : "Pause motion";
    }
    updateAnimationLifecycle();
  }

  bindTabset(modelTabs, (tab) => selectModel(tab.dataset.model));
  bindTabset(experienceTabs, (tab) => selectExperience(tab.getAttribute("aria-controls")));
  bindTabset(demoTabs, (tab) => selectDemo(tab.dataset.mdDemo));
  bindTabset(potentialTabs, (tab) => selectPotentialModel(tab.dataset.potentialModel));
  document.querySelector("#distance-control")?.addEventListener("input", (event) => updatePotential(event.target.value));
  document.querySelector("#third-atom-control")?.addEventListener("input", (event) => updateManyBodyLab(event.target.value));
  animationToggle?.addEventListener("click", () => setAnimationPaused(!userPaused));
  document.addEventListener("visibilitychange", updateAnimationLifecycle);
  window.addEventListener("scroll", schedulePipelineUpdate, { passive: true });
  reducedMotion.addEventListener?.("change", updateAnimationLifecycle);
  window.addEventListener("hashchange", () => selectExperience(window.location.hash.slice(1), false));

  function revealEverything() {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    evidenceRows.forEach(setEvidenceProgress);
    if (pipelineStages[0]) activateStage(pipelineStages[0].dataset.stage);
  }

  if (reducedMotion.matches || !("IntersectionObserver" in window)) revealEverything();
  else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        if (entry.target.matches("[data-reveal]")) entry.target.classList.add("is-visible");
        if (entry.target.matches("[data-value]")) setEvidenceProgress(entry.target);
        if (entry.target.matches("[data-stage]")) activateStage(entry.target.dataset.stage);
      });
    }, { rootMargin: "-18% 0px -58%", threshold: 0.08 });
    [...revealItems, ...evidenceRows].forEach((item) => observer.observe(item));
  }

  selectModel(modelTabs.find((tab) => tab.getAttribute("aria-selected") === "true")?.dataset.model || "alphafold");
  selectDemo("nanowire");
  selectPotentialModel("lj");
  updatePotential(document.querySelector("#distance-control")?.value || 1.2);
  updateManyBodyLab(document.querySelector("#third-atom-control")?.value || 50);
  selectExperience(window.location.hash.slice(1) || "drug-discovery", false);
  updatePipelineFromScroll();

  window.selectModel = selectModel;
  window.activateStage = activateStage;
  window.setEvidenceProgress = setEvidenceProgress;
  window.selectExperience = selectExperience;
  window.selectDemo = selectDemo;
  window.selectPotentialModel = selectPotentialModel;
  window.updatePotential = updatePotential;
  window.updateManyBodyLab = updateManyBodyLab;
  window.setAnimationPaused = setAnimationPaused;
}());
