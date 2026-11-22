#!/bin/sh
# Builds "Zanza Scanner.app" with the Command Line Tools (no Xcode needed) and signs it ad hoc.
set -e
cd "$(dirname "$0")"
APP="build/Zanza Scanner.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
swiftc -O -swift-version 5 -target arm64-apple-macos13.0 \
  -framework SwiftUI -framework ImageCaptureCore -framework AppKit \
  Sources/*.swift -o "$APP/Contents/MacOS/ZanzaScanner"
cp Info.plist "$APP/Contents/Info.plist"
codesign --force --sign - "$APP"
echo "Built $APP"
