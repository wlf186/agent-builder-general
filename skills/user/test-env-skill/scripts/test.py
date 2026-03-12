import sys
import os

print("Python executable:", sys.executable)
print("Python version:", sys.version)
print("Current working directory:", os.getcwd())

# Try to import PyPDF2 (installed in isolated env)
try:
    import PyPDF2
    print("PyPDF2 imported successfully, version:", PyPDF2.__version__)
except ImportError as e:
    print("PyPDF2 import failed:", e)

# List installed packages
import subprocess
result = subprocess.run([sys.executable, "-m", "pip", "list"], capture_output=True, text=True)
print("\nInstalled packages (first 10):")
for line in result.stdout.split('\n')[:12]:
    print(" ", line)
