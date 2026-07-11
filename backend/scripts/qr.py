import os
import sys
import argparse
import qrcode

def generate_qr(data: str, output_path: str, fill_color: str = "black", back_color: str = "white"):
    """
    Generates a QR code and saves it to output_path.
    """
    print(f"[*] Generating QR code for: '{data}'")
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,  # Use high error correction for print scanning
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color=fill_color, back_color=back_color)
    
    # Ensure parent directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        
    img.save(output_path)
    print(f"[+] Saved QR code image to: {os.path.abspath(output_path)}")

def main():
    parser = argparse.ArgumentParser(description="Generate a QR code image.")
    parser.add_argument("data", nargs="?", help="The text or URL to encode in the QR code.")
    parser.add_argument("-o", "--output", default="qr_code.png", help="Output file path (default: qr_code.png).")
    parser.add_argument("--fill", default="black", help="Color of the QR code pixels (default: black).")
    parser.add_argument("--bg", default="white", help="Background color of the QR code (default: white).")
    
    args = parser.parse_args()
    
    data = args.data
    if not data:
        # Prompt user if no positional argument was provided
        try:
            data = input("Enter the text/data for the QR code: ").strip()
        except KeyboardInterrupt:
            print("\n[!] Cancelled.")
            sys.exit(0)
            
    if not data:
        print("[!] Error: No data provided. QR code generation cancelled.")
        sys.exit(1)
        
    generate_qr(data, args.output, args.fill, args.bg)

if __name__ == "__main__":
    main()
