import React, { useState } from "react";
import { Button } from "@heroui/react";
import { Check, FileText } from "lucide-react";
import { toast } from "../ui/ToastProvider";

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
  "description_override": "Women’s Premium Oversized Printed T-Shirt\\n\\nAdd a stylish retro touch to your everyday wardrobe with this premium black oversized printed T-shirt. Designed with a relaxed silhouette and a bold retro cartoon-inspired graphic print, this T-shirt combines comfort with a modern streetwear aesthetic. The soft, breathable fabric and oversized fit make it suitable for casual outings, college wear, travel, and everyday styling.\\n\\nKey Features:\\n\\nPremium-quality fabric\\nStylish oversized / relaxed fit\\nBold high-definition front graphic print\\nClassic round crew neck\\n3/4 sleeves\\nSoft and comfortable feel\\nBreathable and lightweight construction\\nDurable print with vibrant detailing\\nEasy to wash and maintain\\nSuitable for casual, streetwear and everyday looks\\n\\nStyle: Oversized / Relaxed Fit\\nColor: Black\\nPattern: Graphic Print\\nNeck: Round Neck\\nSleeve: 3/4 Sleeve\\nOccasion: Casual, Streetwear, Daily Wear\\nPrint Placement: Front Only",
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
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(FLIPKART_TSHIRT_PROMPT);
      } else {
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
      toast.success("AI Prompt copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy prompt:", err);
      toast.error("Failed to copy prompt");
    }
  };

  return (
    <Button
      size="sm"
      variant="flat"
      color="default"
      onPress={copyToClipboard}
      startContent={
        copied ? (
          <Check className="w-3.5 h-3.5 text-success" />
        ) : (
          <FileText className="w-3.5 h-3.5 text-default-500" />
        )
      }
      className={`h-9 px-3 rounded-[10px] font-medium text-xs border border-divider transition-all ${
        copied
          ? "bg-success/15 text-success border-success/30"
          : "text-foreground bg-content3 hover:bg-default-200"
      }`}
      aria-label="Copy AI prompt template to clipboard"
    >
      {copied ? "Copied!" : "Prompt"}
    </Button>
  );
};
