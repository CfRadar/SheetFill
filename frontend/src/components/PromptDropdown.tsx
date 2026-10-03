import React, { useState, useEffect, useRef } from "react";

export const FLIPKART_TSHIRT_PROMPT = `You are a Flipkart catalog specialist. I have uploaded 6 images of ONE oversized black women's T-shirt design. Return ONLY a valid JSON object (no markdown fences, no explanation) that follows the EXAMPLE below exactly in structure, length and writing style.

HARD LENGTH LIMITS (do not exceed)
- product_title: 5-7 words, max 45 characters. Generic, with no design name. Always: "Women’s Premium Oversized Printed T-Shirt"
- product_description: exactly 3 sentences, max 450 characters.
- key_features: exactly 10 items, each 3-8 words, max 50 characters. No full sentences.
- key_features_sheet: exactly 4 items, max 25 characters each.
- search_keywords: exactly 4 items, max 20 characters each.
- description_override: built ONLY from the fields above in the exact layout shown in the example. Do not add any extra sentences, headings or marketing text. Total must stay under 1000 characters.

CONTENT RULES
1. Describe only what is visible in the images.
2. No trademarked brand names, character names or celebrity names. Describe the art generically (e.g. "retro cartoon-inspired graphic print").
3. Women only. Never write "Men’s/Women’s" or "Unisex".
4. Sleeves are 3/4 sleeves. Never write "short sleeves" or "half sleeves".
5. sku_base: not required in JSON (the system automatically uses the design name from your sheet).
6. Multi-value fields use "::" with no spaces around it.
7. For pattern, surface_styling, detail_placement and tee_length use ONLY the allowed values below, with exact spelling and capitalisation.

ALLOWED VALUES
pattern (1-3): Abstract | Animal Print | Applique | Cartoon | Checkered | Chevron/Zig Zag | Colorblock | Conversational | Diamante Print | Embroidered | Floral Print | Geometric Print | Graphic Print | Military Camouflage | Ombre | Polka Print | Printed | Self Design | Solid | Sporty | Striped | Superhero | Tie & Dye | Tribal Print | Typography | Washed | Washed/Ombre
surface_styling (1-2 or "None"): Applique | Beads & Stones | Bow | Braids | Brand Logo | Buttons | Crochets & Schiffily | Cut-Outs | Cut-work | Epaulettes | Eyelets | Fringed | Knots | Laces | Mesh | Metal Embellishment | None | Patch Work | Pearl | Perforation | Piping Details | Pocket Flap | Pockets | Pompom | Ruffled | Sequins | Shimmer | Side Stripe | Statement Logo | Tassels | Thread Work | Tie-Ups | Twill Tape | Typography | Zipper Details
detail_placement (1): All Over | Back Panel | Chest | Front Panel | Hemline | Hood | Neckline | None | Pocket | Side | Sleeve
tee_length (1): Crop | Long | Medium | Short

EXAMPLE (copy this structure, length and style; replace only the design-specific parts)
{
  "product_title": "Women’s Premium Oversized Printed T-Shirt",
  "product_description": "Add a stylish retro touch to your everyday wardrobe with this premium black oversized printed T-shirt. Designed with a relaxed silhouette and a bold retro cartoon-inspired graphic print, this T-shirt combines comfort with a modern streetwear aesthetic. The soft, breathable fabric and oversized fit make it suitable for casual outings, college wear, travel, and everyday styling.",
  "key_features": [
    "Premium-quality fabric",
    "Stylish oversized / relaxed fit",
    "Bold high-definition front graphic print",
    "Classic round crew neck",
    "3/4 sleeves",
    "Soft and comfortable feel",
    "Breathable and lightweight construction",
    "Durable print with vibrant detailing",
    "Easy to wash and maintain",
    "Suitable for casual, streetwear and everyday looks"
  ],
  "material": "Cotton Blend",
  "pattern": "Graphic Print",
  "sleeve_type": "3/4 Sleeve",
  "neck_type": "Round Neck",
  "fit_type": "Oversized",
  "ideal_for": "Women",
  "color": "Black",
  "brand_color": "Black",
  "occasion": "Casual",
  "style_code": "",
  "description_override": "Women’s Premium Oversized Printed T-Shirt\n\nAdd a stylish retro touch to your everyday wardrobe with this premium black oversized printed T-shirt. Designed with a relaxed silhouette and a bold retro cartoon-inspired graphic print, this T-shirt combines comfort with a modern streetwear aesthetic. The soft, breathable fabric and oversized fit make it suitable for casual outings, college wear, travel, and everyday styling.\n\nKey Features:\n\nPremium-quality fabric\nStylish oversized / relaxed fit\nBold high-definition front graphic print\nClassic round crew neck\n3/4 sleeves\nSoft and comfortable feel\nBreathable and lightweight construction\nDurable print with vibrant detailing\nEasy to wash and maintain\nSuitable for casual, streetwear and everyday looks\n\nStyle: Oversized / Relaxed Fit\nColor: Black\nPattern: Graphic Print\nNeck: Round Neck\nSleeve: 3/4 Sleeve\nOccasion: Casual, Streetwear, Daily Wear\nPrint Placement: Front Only",
  "search_keywords": "Graphic Print::Cartoon::Oversized::Casual",
  "key_features_sheet": "Graphic Print::Oversized Fit::Premium Cotton Fabric::Skin-Friendly Fabric",
  "fabric_care": "Regular Machine Wash",
  "surface_styling": "Typography",
  "tee_length": "Medium",
  "print_coverage": "Chest",
  "sleeve_details": "No Details",
  "detail_placement": "Front Panel",
  "detail_placement_rows": ["S","M","L","XL"]
}

TASK
Now produce the JSON for the uploaded design. Keep every fixed field exactly as in the example (material, sleeve_type, neck_type, fit_type, ideal_for, color, brand_color, occasion, style_code, fabric_care, print_coverage, sleeve_details, detail_placement_rows, and the whole template text of description_override). Change only what depends on the design: the print wording in product_description and key_features[0], pattern, search_keywords, key_features_sheet[0], surface_styling, tee_length, detail_placement and "Print Placement". Output the JSON only.`;

export const PromptDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(FLIPKART_TSHIRT_PROMPT);
      } else {
        // Fallback for non-secure / local setups
        const textArea = document.createElement("textarea");
        textArea.value = FLIPKART_TSHIRT_PROMPT;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy prompt:", err);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Button with dropdown on right */}
      <div className="inline-flex items-center rounded-md shadow-sm border border-slate-700 bg-slate-800 hover:border-slate-600 transition-colors">
        {/* Main action: Click to copy */}
        <button
          type="button"
          onClick={copyToClipboard}
          title="Click to copy prompt"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-700/80 rounded-l-md transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              <span>Prompt</span>
            </>
          )}
        </button>

        {/* Dropdown toggle on right of button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          title="View prompt"
          aria-expanded={isOpen}
          aria-label="View prompt dropdown"
          className={`px-2 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-700/80 rounded-r-md border-l border-slate-700 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 ${
            isOpen ? "bg-slate-700 text-white" : ""
          }`}
        >
          <svg
            className={`w-3.5 h-3.5 transform transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[90vw] max-w-[620px] rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-50 text-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800/90 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <h3 className="text-xs font-bold text-white tracking-wide uppercase">Flipkart Catalog Prompt</h3>
              <span className="text-[11px] text-slate-400 font-mono">(Apparel / T-Shirts)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyToClipboard}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm"
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Copy Prompt</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Subtitle / Instructions */}
          <div className="px-4 py-2 bg-slate-950/50 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Pass this prompt along with 6 product images to your AI vision model:</span>
            <span className="text-[10px] text-slate-500">Auto-copies exact schema &amp; rules</span>
          </div>

          {/* Prompt Viewer Body */}
          <div className="p-4 max-h-[60vh] overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-300 bg-slate-950/80 whitespace-pre-wrap select-all selection:bg-blue-600 selection:text-white scrollbar-thin scrollbar-thumb-slate-700">
            {FLIPKART_TSHIRT_PROMPT}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
            <span>Click inside to select all, or use the copy button.</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
