import React, { useState } from "react";
import { Button } from "@heroui/react";
import { Check, FileText } from "lucide-react";
import { toast } from "../ui/ToastProvider";

export const FLIPKART_TSHIRT_PROMPT = `You are a Flipkart catalog specialist. I will upload exactly ONE reference image containing a T-shirt worn by a model. Analyze this image carefully and derive ALL product information exclusively from what is visibly supported by the image, including garment type, gender, color, fit, sleeve length, neckline, length, artwork, graphics, typography, design placement, pattern, and styling. Do not assume the garment is women's, men's, unisex, black, oversized, or any particular style. The model's appearance alone must not determine the garment's gender category. Use only visible evidence, and never invent or assume missing details. If a detail cannot be reliably determined from the image, use an appropriate neutral value or an empty string where permitted.

Return ONLY a valid JSON object, without Markdown fences or explanations. Follow the exact JSON structure, field order, and writing style of the example. Generate an SEO-friendly Flipkart listing that accurately represents the uploaded product and complies with marketplace guidelines. Do not include brand names, celebrity names, or copyrighted character names.

HARD LENGTH LIMITS
- product_title: 5–7 words, maximum 45 characters. Generate a title matching the actual garment and its visibly supported characteristics. Do not force a fixed gender, color, or fit.
- product_description: Exactly 3 sentences, maximum 450 characters.
- key_features: Exactly 10 items, each 3–8 words, maximum 50 characters per item.
- key_features_sheet: Exactly 4 items, maximum 25 characters each.
- search_keywords: Exactly 4 items, maximum 20 characters each.
- description_override: Use only the specified template and information from the generated JSON fields. Do not add extra headings, sentences, or marketing claims. Maximum 1000 characters.

CONTENT RULES
1. The single uploaded reference image is the sole source of truth for all product-specific details. Do not use assumptions, previous listings, example values, or default product attributes.
2. Identify the actual garment and its characteristics from the image. Adapt every relevant JSON field to the visible product, including gender category, garment color, brand color, fit, sleeves, neckline, length, material when verifiable, pattern, surface styling, and print placement.
3. Do not automatically classify the garment as women's or men's based only on the model's gender or appearance. Select a gender category only when supported by reliable product-specific visual evidence; otherwise use an appropriate neutral value permitted by the schema.
4. Never force 3/4 sleeves, oversized fit, round neck, black color, cotton blend, or any other example attribute unless the image supports it. Describe sleeve length and neckline accurately. If the exact sleeve length or material cannot be established visually, do not invent it.
5. Do not describe invisible fabric properties, comfort, breathability, durability, print quality, or care requirements as verified facts unless explicitly supported by the image. Use neutral wording or empty values where permitted.
6. Do not include trademarked brand names, celebrity names, or copyrighted character names. Describe recognizable artwork generically.
7. Use "::" to separate multiple values, with no spaces around the separator.
8. For pattern, surface_styling, detail_placement, and tee_length, use only the allowed values below, with exact spelling and capitalization.

ALLOWED VALUES

pattern (1–3): Abstract | Animal Print | Applique | Cartoon | Checkered | Chevron/Zig Zag | Colorblock | Conversational | Diamante Print | Embroidered | Floral Print | Geometric Print | Graphic Print | Military Camouflage | Ombre | Polka Print | Printed | Self Design | Solid | Sporty | Striped | Superhero | Tie & Dye | Tribal Print | Typography | Washed | Washed/Ombre

surface_styling (1–2 or "None"): Applique | Beads & Stones | Bow | Braids | Brand Logo | Buttons | Crochets & Schiffily | Cut-Outs | Cut-work | Epaulettes | Eyelets | Fringed | Knots | Laces | Mesh | Metal Embellishment | None | Patch Work | Pearl | Perforation | Piping Details | Pocket Flap | Pockets | Pompom | Ruffled | Sequins | Shimmer | Side Stripe | Statement Logo | Tassels | Thread Work | Tie-Ups | Twill Tape | Typography | Zipper Details

detail_placement (1): All Over | Back Panel | Chest | Front Panel | Hemline | Hood | Neckline | None | Pocket | Side | Sleeve

tee_length (1): Crop | Long | Medium | Short

REFERENCE JSON STRUCTURE

Use the following example only as a structural template, not as a source of product facts. Replace every example-specific value with information supported by the uploaded image. Preserve all keys and their order.

{
  "product_title": "",
  "product_description": "",
  "key_features": [
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    ""
  ],
  "material": "",
  "pattern": "",
  "sleeve_type": "",
  "neck_type": "",
  "fit_type": "",
  "ideal_for": "",
  "color": "",
  "brand_color": "",
  "occasion": "",
  "style_code": "",
  "description_override": "",
  "search_keywords": "",
  "key_features_sheet": "",
  "fabric_care": "",
  "surface_styling": "",
  "tee_length": "",
  "print_coverage": "",
  "sleeve_details": "",
  "detail_placement": "",
  "detail_placement_rows": ["S","M","L","XL"]
}

DESCRIPTION_OVERRIDE RULES

Build description_override from the generated product_title, product_description, and key_features, followed by the style, color, pattern, neckline, sleeve, occasion, and print-placement details in the same layout as the example. Keep it under 1000 characters. Ensure every value agrees with the other JSON fields. Do not retain example-specific details that contradict the reference image.

FINAL VALIDATION
- Return valid JSON only, with double-quoted keys and string values where applicable.
- Include exactly the keys and order shown in the reference structure.
- Include exactly 10 key_features and 4 "::"-separated search_keywords and key_features_sheet entries.
- Use only allowed values for pattern, surface_styling, detail_placement, and tee_length.
- Derive every product-specific attribute from the single uploaded image, not from the model's assumed gender, example defaults, or previous products.
- Never force a fixed title, gender, sleeve length, fit, color, fabric, or neckline.
- Do not invent details to fill missing visual information.

TASK
Analyze the single uploaded reference image and generate the complete Flipkart product listing JSON. The image is the only reference. Output JSON only.`;

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
