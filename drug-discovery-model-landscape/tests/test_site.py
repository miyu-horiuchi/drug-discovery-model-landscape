from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT.joinpath("index.html").read_text(encoding="utf-8")


class SiteContentTests(unittest.TestCase):
    def test_required_sections_exist(self):
        for section_id in ("top", "pipeline", "models", "adoption", "alphafold", "stack", "sources"):
            self.assertRegex(HTML, rf'id=["\']{section_id}["\']')

    def test_each_named_technology_is_present(self):
        for name in ("AlphaFold", "ESM", "Evo 2", "Schrödinger", "Genesis"):
            self.assertIn(name, HTML)

    def test_evidence_values_and_labels_are_explicit(self):
        for value in ("71%", "34–38%", "100%", "15%", "5%"):
            self.assertIn(value, HTML)
        for label in ("Published", "Verified", "Public partnership", "Directional estimate"):
            self.assertIn(label, HTML)

    def test_alphafold_benchmark_percentages_have_published_labels(self):
        benchmark = re.search(r"<p>.*?In a 28-target.*?</p>", HTML).group(0)
        taar1 = re.search(r"<p>.*?A prospective TAAR1.*?</p>", HTML).group(0)
        label = '<span class="evidence-label">Published</span>'
        self.assertIn(label, benchmark)
        self.assertIn(label, taar1)

    def test_sources_are_direct_https_links(self):
        links = re.findall(r'href="(https://[^"]+)"', HTML)
        self.assertGreaterEqual(len(links), 8)
        self.assertTrue(any("sec.gov" in link for link in links))
        self.assertTrue(any("pubmed.ncbi.nlm.nih.gov" in link for link in links))
        self.assertTrue(any("github.com/google-deepmind" in link for link in links))

    def test_progressive_enhancement_assets_are_linked(self):
        self.assertIn('href="styles.css"', HTML)
        self.assertIn('src="script.js"', HTML)

    def test_inline_favicon_prevents_a_missing_asset_request(self):
        self.assertRegex(HTML, r'<link rel="icon" href="data:image/svg\+xml,')

    def test_css_contains_visual_and_accessibility_contracts(self):
        css = ROOT.joinpath("styles.css").read_text(encoding="utf-8")
        for token in ("--ink", "--protein", "--genome", "--ligand", "--text", "--muted"):
            self.assertIn(token, css)
        self.assertIn("@media (prefers-reduced-motion: reduce)", css)
        self.assertIn("@media (max-width: 720px)", css)
        self.assertIn(":focus-visible", css)
        self.assertIn(".no-js", css)
        self.assertIn("[aria-selected=\"true\"]", css)

    def test_mobile_model_tabs_keep_focus_ring_inside_scrollport(self):
        css = ROOT.joinpath("styles.css").read_text(encoding="utf-8")
        self.assertRegex(
            css,
            r"\.model-tabs button:focus-visible\s*\{[^}]*outline-offset:\s*-\d+px",
        )

    def test_script_exposes_required_interaction_contract(self):
        script = ROOT.joinpath("script.js").read_text(encoding="utf-8")
        for signature in ("function selectModel", "function activateStage", "function setEvidenceProgress"):
            self.assertIn(signature, script)
        self.assertIn("IntersectionObserver", script)
        self.assertIn("prefers-reduced-motion", script)
        self.assertIn("ArrowRight", script)
        self.assertIn("ArrowLeft", script)

    def test_two_top_level_experiences_exist(self):
        for element_id in ("tab-drug", "tab-mlip", "drug-discovery", "interatomic-potentials"):
            self.assertRegex(HTML, rf'id=["\']{element_id}["\']')
        self.assertIn('role="tablist"', HTML)
        self.assertIn('href="#interatomic-potentials"', HTML)

    def test_mlip_sections_and_examples_are_complete(self):
        for section_id in (
            "md-intro", "md-applications", "energy-force", "scale-hierarchy",
            "potential-evolution", "many-body-lab", "mlip-future",
        ):
            self.assertRegex(HTML, rf'id=["\']{section_id}["\']')
        for demo in ("nanowire", "brazing", "impact", "assembly", "catalysis"):
            self.assertIn(f'data-md-demo="{demo}"', HTML)

    def test_potential_evolution_names_and_source_links_exist(self):
        for name in (
            "Lennard–Jones", "Morse", "Stillinger–Weber", "Embedded Atom Method",
            "Behler–Parrinello", "Gaussian Approximation Potentials", "CGCNN", "NequIP", "M3GNet",
        ):
            self.assertIn(name, HTML)
        for doi in (
            "10.1103/PhysRevB.31.5262", "10.1103/PhysRevB.29.6443",
            "10.1103/PhysRevLett.98.146401", "10.1103/PhysRevLett.104.136403",
            "10.1103/PhysRevLett.120.145301", "10.1038/s41467-022-29939-5",
            "10.1016/j.mtphys.2022.100712",
        ):
            self.assertIn(doi, HTML)

    def test_mlip_scope_caveats_are_explicit(self):
        self.assertIn("explanatory abstraction", HTML)
        self.assertIn("not itself a force-field formulation", HTML)
        self.assertIn("F = −∇E", HTML)

    def test_mlip_interaction_contracts_exist(self):
        script = ROOT.joinpath("script.js").read_text(encoding="utf-8")
        for signature in (
            "function selectExperience", "function selectDemo", "function selectPotentialModel",
            "function updatePotential", "function updateManyBodyLab", "function setAnimationPaused",
        ):
            self.assertIn(signature, script)
        self.assertIn("requestAnimationFrame", script)
        self.assertIn("cancelAnimationFrame", script)
        self.assertIn("hashchange", script)

    def test_mlip_visual_contracts_exist(self):
        css = ROOT.joinpath("styles.css").read_text(encoding="utf-8")
        for selector in (
            ".experience-switcher", ".atom-stage", ".potential-plot", ".scale-map",
            ".architecture-viewer", ".many-body-lab", ".future-loop",
        ):
            self.assertIn(selector, css)

    def test_tabpanel_wrappers_receive_section_layout(self):
        css = ROOT.joinpath("styles.css").read_text(encoding="utf-8")
        self.assertIn('main > [role="tabpanel"] > section', css)

    def test_evidence_progress_contract_uses_one_variable(self):
        css = ROOT.joinpath("styles.css").read_text(encoding="utf-8")
        script = ROOT.joinpath("script.js").read_text(encoding="utf-8")
        self.assertIn('width: var(--progress)', css)
        self.assertIn('setProperty("--progress"', script)

    def test_pipeline_has_scroll_linked_activation(self):
        script = ROOT.joinpath("script.js").read_text(encoding="utf-8")
        self.assertIn("function updatePipelineFromScroll", script)
        self.assertIn('addEventListener("scroll"', script)

    def test_architecture_viewer_has_live_indicators(self):
        for indicator in ("locality", "directionality", "universality"):
            self.assertIn(f'data-indicator="{indicator}"', HTML)
        self.assertIn('data-pipeline="', HTML)

    def test_directional_ranges_and_mlip_fundamentals_source_are_explicit(self):
        for value in ("40–70%", "10–30%", "1–5%", "10–25%"):
            self.assertIn(value, HTML)
        self.assertIn("Analyst range", HTML)
        self.assertIn("https://docs.lammps.org/Intro.html", HTML)

    def test_each_analyst_range_is_labeled_directional(self):
        for value in ("40–70%", "10–30%", "1–5%", "10–25%"):
            row = re.search(rf'<div class="evidence-row"[^>]*>.*?{value}.*?</div>', HTML).group(0)
            self.assertIn("Directional estimate", row)

    def test_architecture_rail_spans_all_three_viewer_rows(self):
        css = ROOT.joinpath("styles.css").read_text(encoding="utf-8")
        self.assertRegex(css, r"\.architecture-tabs\s*\{[^}]*grid-row:\s*span 3")


if __name__ == "__main__":
    unittest.main()
