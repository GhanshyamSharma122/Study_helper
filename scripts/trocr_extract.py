"""Read one handwritten answer image from stdin and print extracted text as JSON."""
import json
import sys
from io import BytesIO

from PIL import Image
from transformers import TrOCRProcessor, VisionEncoderDecoderModel


def main():
    image = Image.open(BytesIO(sys.stdin.buffer.read())).convert("RGB")
    processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-handwritten")
    model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-base-handwritten")
    pixel_values = processor(images=image, return_tensors="pt").pixel_values
    generated_ids = model.generate(pixel_values, max_new_tokens=256)
    text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0].strip()
    print(json.dumps({"text": text}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
