import subprocess
import sys

# Install PyPDF2
subprocess.run([sys.executable, "-m", "pip", "install", "PyPDF2", "--quiet"], capture_output=True)

import PyPDF2
import os

pdf_dir = r"c:\Users\Inno\Desktop\fair_bill"
output_file = os.path.join(pdf_dir, "pdf_extracted_text.txt")

pdf_files = [
    "PRISM-P Problem Brief.pdf",
    "PRISM-R PRD-Lite.pdf",
    "PRISM-S Design Document (RFC).pdf",
    "PRISM-M Task Breakdown Structure (TBS).pdf",
    "PRISM-I Solution Options Matrix.pdf"
]

with open(output_file, "w", encoding="utf-8") as out:
    for pdf_file in pdf_files:
        pdf_path = os.path.join(pdf_dir, pdf_file)
        out.write(f"\n{'='*80}\n")
        out.write(f"FILE: {pdf_file}\n")
        out.write(f"{'='*80}\n\n")
        try:
            with open(pdf_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for i, page in enumerate(reader.pages):
                    text = page.extract_text()
                    out.write(f"\n--- Page {i+1} ---\n")
                    out.write(text)
                    out.write("\n")
        except Exception as e:
            out.write(f"Error: {e}\n")

print(f"Done. Output saved to {output_file}")
