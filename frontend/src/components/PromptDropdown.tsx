import React, { useState } from "react";
import { Button } from "@heroui/react";
import { Check, FileText } from "lucide-react";
import { toast } from "../ui/ToastProvider";

export const FLIPKART_TSHIRT_PROMPT = `You are an expert Flipkart catalog and apparel vision specialist. I am uploading a reference image showing a model wearing a T-shirt. Analyze the image with extreme visual precision and generate a 100% accurate, complete Flipkart listing JSON object.

CRITICAL EVALUATION GUIDELINES (EVALUATE THE REFERENCE MODEL IN THE PHOTO):

1. TARGET GENDER & AUDIENCE (ideal_for):
   - Look directly at the human model wearing the garment in the photo:
     * If a male model (man / boy) is wearing the T-shirt: set "ideal_for": "Men". The product_title MUST start with "Men" or "Men's".
     * If a female model (woman / girl) is wearing the T-shirt: set "ideal_for": "Women". The product_title MUST start with "Women" or "Women's".
     * If both a male and female model appear together, or if it is explicitly a matching couple set: set "ideal_for": "Couple".
     * Flat-lay / garment alone without any model: Only in this rare case evaluate cut ("Men", "Women", or "Unisex").
   - NEVER mark "Unisex" if a clear male or female model is wearing the garment. Always assign the model's actual gender.

2. PATTERN & PRINT TYPE (pattern):
   - Inspect the artwork on the T-shirt with high precision:
     * Graphic Print: Choose "Graphic Print" if there is ANY illustration, anime/manga art, cartoon/character, drawing, painting, skull, vehicle, animal, abstract visual artwork, or graphic image (even if accompanied by words or brand typography).
     * Typography: Choose "Typography" ONLY if the garment has purely written text, words, quotes, slogans, or letters with NO visual drawings/graphics.
     * Solid: Choose "Solid" if the garment is completely plain without any graphic, print, or text.
     * Striped: Choose "Striped" for horizontal, vertical, or diagonal stripes across the body.
     * Colorblock: Choose "Colorblock" for contrasting cut-and-sew geometric color panels.
     * Tie & Dye: Choose "Tie & Dye" for tie-dye, acid wash, or dip-dye effects.

3. PRINT COVERAGE & DETAIL PLACEMENT (print_coverage, detail_placement):
   - Chest: Print is restricted to the upper chest / pocket area -> "print_coverage": "Chest", "detail_placement": "Chest".
   - Full Front: Large print occupying the front torso/stomach -> "print_coverage": "Full Front", "detail_placement": "Front Panel".
   - Back: Main artwork is printed on the back panel -> "print_coverage": "Back", "detail_placement": "Back Panel".
   - All Over: Print/pattern repeats continuously across front, back, and sleeves -> "print_coverage": "All Over", "detail_placement": "All Over".
   - None: For solid plain t-shirts with no print -> "print_coverage": "None", "detail_placement": "None".

4. FIT & SILHOUETTE (fit_type):
   - Evaluate the fit on the reference model:
     * Oversized: Noticeable drop shoulder (seam rests 2-4 inches below the natural shoulder line), baggy/loose torso, wide roomy sleeves extending near or past the elbows -> "fit_type": "Oversized".
     * Slim: Snug body-conscious fit, closely hugging the chest and arms -> "fit_type": "Slim".
     * Regular: Shoulder seam aligns directly with the natural shoulder bone, standard straight body drape -> "fit_type": "Regular".
     * Boxy: Wide, square torso cut with relaxed drape -> "fit_type": "Boxy".

5. COLLAR & SLEEVE (neck_type, sleeve_type):
   - neck_type:
     * "Round Neck" (standard circular rib collar; also accepted: "Crew Neck")
     * "Polo Neck" (folded collar with 2-3 button placket)
     * "V Neck" (V-shaped neckline)
     * "Hooded Neck" (has an attached hood)
     * "Henley Neck" (collarless round neck with button placket)
   - sleeve_type:
     * "Half Sleeve" (short sleeve ending between mid-bicep and elbow)
     * "Full Sleeve" (long sleeve reaching wrist)
     * "Sleeveless" (no sleeves / tank)

6. COLOR MAPPING (color, brand_color):
   - color: MUST map to one of Flipkart's official primary color categories:
     Black | White | Beige | Blue | Dark Blue | Navy Blue | Light Blue | Brown | Dark Green | Green | Grey | Maroon | Orange | Pink | Purple | Red | Yellow | Multicolor.
     (Map Cream, Off-White, Ivory to "Beige" or "White"; map Charcoal to "Grey" or "Black").
   - brand_color: The specific nuanced shade seen on the model (e.g. "Sage Green", "Charcoal Black", "Off White", "Dusty Lavender", "Mustard Yellow").

7. MATERIAL & FABRIC (material):
   - "100% Cotton", "Pure Cotton", or "Cotton Blend" for standard matte casual jersey t-shirts.
   - "Polyester" or "Polycotton" for shiny athletic/dry-fit gym t-shirts.

8. PRODUCT TITLE FORMULA (product_title):
   - Structure: [ideal_for] [fit_type (if Oversized/Slim)] [pattern] [neck_type] [sleeve_type] T-Shirt
   - Strict length: 35 to 65 characters, 5 to 8 words.
   - Examples:
     * "Men Oversized Graphic Printed Round Neck T-Shirt"
     * "Women Oversized Graphic Printed Round Neck T-Shirt"
     * "Men Regular Fit Solid Polo Neck Half Sleeve T-Shirt"
     * "Women Typography Printed Round Neck Half Sleeve T-Shirt"

9. KEY FEATURES (key_features):
   - Array of EXACTLY 10 strings formatted strictly as "Label: Value":
     1. "Design: [Accurately describe what is visually printed on the t-shirt, e.g. Back Japanese Samurai Anime Graphic / Front Minimalist Typography / Solid Plain Tone]"
     2. "Fit: [e.g. Modern Oversized Drop-Shoulder Streetwear Fit / Classic Regular Fit]"
     3. "Neck: [e.g. Durable Ribbed Round Neckline / Ribbed Polo Collar]"
     4. "Sleeve: [e.g. Relaxed Half Sleeves with Clean Finished Hems]"
     5. "Fabric: [e.g. 100% Breathable Combed Cotton Jersey]"
     6. "Color: [Primary color and exact shade description]"
     7. "Style: [e.g. Urban Streetwear, Daily Casual & College Wear]"
     8. "Gender: [Men / Women / Couple - strictly matching the model]"
     9. "Occasion: [Casual Outings, Weekend Hangouts, Daily Wear]"
     10. "Care Instructions: [Machine wash cold inside out, do not iron directly on print]"

10. PRODUCT DESCRIPTION (product_description):
    - Exactly 3 to 4 cohesive, engaging sentences (200 to 450 characters) summarizing the aesthetic, visual artwork, fabric comfort, fit silhouette, and styling recommendation (e.g. pairs well with cargo pants, denim, or shorts).

11. STYLE CODE (style_code):
    - Clean uppercase slug like: [GENDER]-[FIT]-[COLOR]-[KEYWORD]-01 (e.g. "MEN-OS-BLK-ANIME-01").

ALLOWED VALUES REFERENCE:
- ideal_for: Men | Women | Couple | Unisex
- fit_type: Oversized | Regular | Slim | Boxy
- neck_type: Round Neck | Crew Neck | Polo Neck | V Neck | Hooded Neck | Henley Neck
- sleeve_type: Half Sleeve | Full Sleeve | Sleeveless | 3/4 Sleeve
- pattern: Graphic Print | Typography | Solid | Striped | Colorblock | Printed | Tie & Dye | Abstract | Cartoon
- material: 100% Cotton | Pure Cotton | Cotton Blend | Polyester | Polycotton
- detail_placement: Chest | Front Panel | Back Panel | All Over | None
- print_coverage: Chest | Full Front | Back | All Over | None
- tee_length: Medium | Short | Long | Crop

JSON OUTPUT STRUCTURE (Return ONLY valid JSON, no markdown formatting, no commentary):
{
  "product_title": "",
  "product_description": "",
  "key_features": [
    "Design: ...",
    "Fit: ...",
    "Neck: ...",
    "Sleeve: ...",
    "Fabric: ...",
    "Color: ...",
    "Style: ...",
    "Gender: ...",
    "Occasion: ...",
    "Care Instructions: ..."
  ],
  "material": "",
  "pattern": "",
  "sleeve_type": "",
  "neck_type": "",
  "fit_type": "",
  "ideal_for": "",
  "color": "",
  "brand_color": "",
  "occasion": "Casual",
  "style_code": "",
  "tee_length": "Medium",
  "print_coverage": "",
  "detail_placement": "",
  "fabric_care": "Machine wash cold inside out, do not iron on print"
}`;

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
