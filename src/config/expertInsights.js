// ============================================
// Expert Insight Component - Shows expert context on metrics
// Attribution: Expert Advisors MR and SW
// ============================================
export const EXPERT_INSIGHTS = {
  sensitivity: {
    title: "Understanding Sensitivity Claims",
    experts: "MR",
    content: `"Sensitivity" alone can be ambiguous. Here are helpful distinctions:

Clinical sensitivity refers to the percentage of patients who recurred that were correctly identified as MRD-positive. This is often what clinicians assume, but not always what's reported.

Analytical sensitivity refers to detection rate in lab validation conditions, which may differ from real-world clinical performance.

Landmark vs Longitudinal: Landmark measures detection at a single post-surgery timepoint. Longitudinal measures detection at any timepoint across multiple draws, which typically yields higher numbers.

Helpful questions to ask: What type of sensitivity? At what timeframe? For which stages? What was the sample size?`
  },
  stageSpecific: {
    title: "Why Stage-Specific Sensitivity Matters",
    experts: "MR",
    content: `When sensitivity is reported for combined stages (II, III, IV together), it can be helpful to understand the breakdown.

Stage II presents the greatest detection challenge due to lower tumor burden and less circulating tumor DNA. Yet Stage II is often where MRD-guided therapy decisions have the most impact.

Stage III/IV cases typically have more ctDNA and higher detection rates, which can lift overall sensitivity figures when stages are combined.

For a Stage II patient considering adjuvant therapy, stage-specific sensitivity data—when available—may be more directly relevant than blended numbers.

What to look for: Tests that report stage-specific data separately provide more granular information for decision-making.

Stage-specific reporting helps clinicians and patients make more informed comparisons, and we encourage vendors to provide this breakdown where feasible.`
  },
  stageMissing: {
    title: "Why Stage-Specific Data Matters",
    experts: "MR",
    content: `Stage-specific sensitivity data helps clinicians and patients make more informed decisions.

Why it's important: Stage II patients considering adjuvant therapy benefit from understanding how the test performs specifically for their situation, as detection rates typically vary by stage.

What you can do: Consider asking the vendor about stage-specific performance data—they may have additional information available.

We encourage vendors to provide stage-specific breakdowns where feasible, as this openness helps the entire field.`
  },
  specificity: {
    title: "Understanding Specificity Claims",
    experts: "MR, SW",
    content: `For MRD testing, specificity may be particularly important—especially in low-recurrence populations where most patients are already cured.

Analytical vs Clinical Specificity:
Analytical specificity measures how often the test correctly identifies negative samples as negative in the lab. This is important for repeat monitoring scenarios.

Clinical specificity measures how often MRD-negative results correspond with no eventual recurrence. Interpretation can be complex in studies where MRD-positive patients receive treatment.

Reporting considerations:
Per-timepoint vs per-patient reporting can yield different numbers. With serial testing, it's worth understanding how false positive probability may compound.

Analytical specificity becomes especially relevant with repeat testing, where even small false positive rates can accumulate over serial draws.`
  },
  analyticalVsClinicalSpecificity: {
    title: "Analytical vs Clinical Specificity",
    experts: "MR, SW",
    content: `These metrics answer different questions and are worth understanding separately:

Analytical Specificity
What it measures: How often does the test correctly identify truly negative samples as negative in laboratory conditions?
Why it matters: Important for repeat monitoring—even 99% specificity means approximately 5% cumulative false positive probability over 5 annual tests.
How it's measured: Typically using contrived samples or healthy donor plasma.

Clinical Specificity
What it measures: How often does an MRD-negative result correspond with no eventual recurrence?
Interpretation note: In interventional trials where MRD-positive patients receive treatment, the "true" recurrence rate without treatment isn't directly observable.
Context: This metric is sometimes better understood as negative predictive value (NPV) in context.

Why both matter:
Analytical specificity reflects the test's inherent performance characteristics.
Clinical specificity is influenced by both test performance and treatment effects.

When vendors report "specificity" without specifying type, it's reasonable to ask which measurement is being referenced.`
  },
  lod: {
    title: "Understanding LOD Comparisons",
    experts: "MR, SW",
    content: `LOD (Limit of Detection) values can be difficult to compare directly across different MRD test architectures. We display values exactly as reported by each vendor without conversion.

LOD vs LOD95 — an important distinction:
LOD (detection threshold): The level where signal can be detected, though not necessarily reliably.
LOD95: The level where detection occurs 95% of the time.

Why this matters for monitoring:
When LOD is significantly lower than LOD95, the test may detect lower levels occasionally. Serial testing provides additional opportunities for detection.
When LOD and LOD95 are similar, detection below the threshold is unlikely even with repeat testing.

Other comparison considerations:
Different units (ppm, VAF%, molecules/mL) don't convert directly.
Pre-analytical factors like extraction efficiency can affect results.

The gap between LOD and LOD95 can be particularly relevant for surveillance protocols where serial testing is planned.`
  },
  lodVsLod95: {
    title: "LOD vs LOD95: Why Both Matter",
    experts: "MR, SW",
    content: `Understanding both LOD and LOD95 provides helpful context for test performance:

The key distinction:
LOD (detection threshold): Signal can be detected, but not reliably at this level.
LOD95: Detection occurs 95% of the time at this level.

Why the gap between them matters:
If a test has LOD of 0.5 ppm but LOD95 of 5 ppm, this can actually be favorable for monitoring—there's a chance of detecting variants below 5 ppm with repeat testing, and serial samples provide multiple detection opportunities.

If LOD ≈ LOD95 (very close together), detection below LOD95 is unlikely even with multiple samples.

Practical implication:
Tests where LOD is notably lower than LOD95 may offer additional surveillance potential through serial testing. This gap is one factor worth considering when evaluating tests for monitoring protocols.`
  },
  bloodVolume: {
    title: "Blood Volume Context",
    experts: "MR",
    content: `Higher blood volume and more variants tracked don't automatically indicate better performance.

Error suppression and assay design can matter significantly—a smaller panel with excellent noise control may perform comparably to or better than a larger panel.

Different test architectures work in different ways, so direct comparisons based on volume or variant count alone may not reflect overall test quality.

Blood volume is primarily relevant for practical considerations (ease of blood draw) rather than as a direct quality indicator.`
  },
  cfdnaInput: {
    title: "cfDNA Input vs Blood Volume",
    experts: "SW",
    content: `For research applications, cfDNA input (measured in ng) can be as relevant as blood volume (mL).

Why this distinction matters:
Different extraction methods yield different cfDNA amounts from the same blood volume.
The amount of cfDNA that enters the assay affects the analytical sensitivity ceiling.
Genome equivalents analyzed (approximately 3.3 pg per haploid genome) represents the true denominator.

What to consider:
Blood volume (mL): How much blood is drawn
cfDNA yield: How much cfDNA is extracted
Input to assay (ng): How much cfDNA enters the test

A test using more blood but less cfDNA input may have different performance characteristics than one using less blood with more cfDNA input. Input amounts aren't always disclosed but can significantly impact sensitivity.`
  },
  tumorInformed: {
    title: "Tumor-Informed vs Tumor-Naïve",
    experts: "MR",
    content: `Both approaches have legitimate clinical applications:

Tumor-informed testing requires tumor tissue to identify patient-specific mutations, then tracks those in blood. Generally offers higher sensitivity but requires tissue availability.

Tumor-naïve (tumor-agnostic) testing works without tumor tissue, using common cancer signals such as mutations or methylation patterns. More convenient when tissue isn't available but may miss patient-specific variants.

Neither approach is universally superior—the best choice depends on clinical context, tissue availability, cancer type, and intended use.`
  },
  clinicalTrials: {
    title: "Interpreting Clinical Trial Data",
    experts: "MR",
    content: `Clinical sensitivity from interventional trials requires careful interpretation.

Treatment effects on outcomes: In trials where MRD-positive patients receive additional therapy, some may be cured by that treatment. This makes it difficult to determine how many would have recurred without intervention.

Stage composition: When results combine multiple stages (II, III, IV), it's helpful to understand the breakdown when available, as detection rates typically vary by stage.

These factors don't diminish the value of clinical trial data—they simply provide context for interpretation.`
  },
  mrdUseCases: {
    title: "MRD vs Treatment Response vs Surveillance",
    experts: "MR",
    content: `MRD tests can support three distinct clinical decisions:

Landmark MRD: A single post-surgery timepoint to help decide on adjuvant therapy. This is often the most clinically actionable use case.

Treatment Response Monitoring: Serial tests during therapy to assess whether treatment is working, based on ctDNA kinetics.

Surveillance: Periodic testing off-therapy to detect recurrence earlier than imaging.

Many assays span more than one use-case, but trial design, endpoints, and performance claims often target just one. Sensitivity figures from a surveillance study may not apply to landmark detection, and vice versa.

When comparing tests, consider which use-case the reported performance data reflects.`
  }
};
