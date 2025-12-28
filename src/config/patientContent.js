// ============================================
// Patient Info Modal Content
// ============================================
export const PATIENT_INFO_CONTENT = {
  therapy: {
    title: "Finding the Right Therapy",
    subtitle: "How genomic testing can guide your treatment",
    icon: "🎯",
    color: "violet",
    content: [
      {
        heading: "What is genomic testing?",
        text: "Genomic tests analyze your tumor's DNA to find specific changes (mutations) that might be driving your cancer's growth. Think of it like finding the specific weak point in your cancer."
      },
      {
        heading: "Why does it matter?",
        text: "Many new cancer drugs are designed to target specific mutations. If your tumor has one of these mutations, a targeted therapy might work better than traditional chemotherapy—often with fewer side effects."
      },
      {
        heading: "What to expect",
        text: "Your doctor may order a test using either a tissue sample from your tumor or a simple blood draw. Results typically take 1-2 weeks and will show which treatments might work best for your specific cancer."
      },
      {
        heading: "Questions to ask your doctor",
        list: [
          "Is genomic testing right for my type of cancer?",
          "Are there targeted therapies available if we find a mutation?",
          "Will my insurance cover this test?"
        ]
      }
    ]
  },
  monitoring: {
    title: "Tracking My Progress",
    subtitle: "Blood tests that show if treatment is working",
    icon: "📈",
    color: "rose",
    content: [
      {
        heading: "What are liquid biopsies?",
        text: "These blood tests detect tiny pieces of tumor DNA floating in your bloodstream. As your tumor responds to treatment, the amount of this DNA changes—giving your doctor a real-time view of how well treatment is working."
      },
      {
        heading: "Why is this better than scans alone?",
        text: "Blood tests can sometimes detect changes weeks or months before they show up on CT scans or MRIs. This early warning can help your doctor adjust treatment sooner if needed."
      },
      {
        heading: "What to expect",
        text: "Just a simple blood draw—no surgery or imaging required. Your doctor may order these tests regularly during treatment to track your progress over time."
      },
      {
        heading: "Questions to ask your doctor",
        list: [
          "How often should I have this test during treatment?",
          "What changes in results should concern me?",
          "How do these tests complement my regular scans?"
        ]
      }
    ]
  },
  surveillance: {
    title: "Keeping Watch After Treatment",
    subtitle: "Detecting recurrence earlier than ever before",
    icon: "🔬",
    color: "orange",
    content: [
      {
        heading: "What is MRD testing?",
        text: "MRD stands for Minimal Residual Disease. These highly sensitive blood tests can detect microscopic amounts of cancer DNA that might remain after treatment—amounts too small to see on any scan."
      },
      {
        heading: "Why is early detection important?",
        text: "If cancer does return, catching it at the earliest possible stage often means more treatment options and better outcomes. MRD tests can sometimes detect recurrence months before traditional methods."
      },
      {
        heading: "What to expect",
        text: "After you complete treatment, your doctor may recommend periodic blood tests (often every 3-6 months) to monitor for any signs of the cancer returning. Some tests require an initial sample of your tumor to create a personalized test."
      },
      {
        heading: "Questions to ask your doctor",
        list: [
          "Am I a good candidate for MRD monitoring?",
          "How often should I be tested?",
          "What happens if the test detects something?"
        ]
      }
    ]
  }
};
