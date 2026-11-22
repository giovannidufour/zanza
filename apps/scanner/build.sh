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
# Admin link (0138): Supabase URL + publishable key (public) and media base URL, from the git-ignored env file
ENV=../storefront/.supabase.env
if [ -f "$ENV" ]; then
  URL=$(grep '^SUPABASE_URL=' "$ENV" | cut -d= -f2- | tr -d '"')
  KEY=$(grep '^SUPABASE_PUBLISHABLE_KEY=' "$ENV" | cut -d= -f2- | tr -d '"')
  MEDIA=$(sed -n 's/.*"mediaBaseUrl": *"\([^"]*\)".*/\1/p' ../storefront/site.json)
  /usr/libexec/PlistBuddy -c "Add :ZanzaSupabaseURL string $URL" -c "Add :ZanzaSupabaseKey string $KEY" -c "Add :ZanzaMediaBaseURL string $MEDIA" "$APP/Contents/Info.plist"
fi
codesign --force --sign - "$APP"
echo "Built $APP"
