#!/bin/sh
# Builds "HIGHMUZIK Scanner.app" with the Command Line Tools (no Xcode needed) and signs it ad hoc.
set -e
cd "$(dirname "$0")"
APP="build/HIGHMUZIK Scanner.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
swiftc -O -swift-version 5 -target arm64-apple-macos13.0 \
  -framework SwiftUI -framework ImageCaptureCore -framework AppKit \
  Sources/*.swift -o "$APP/Contents/MacOS/HighmuzikScanner"
cp Info.plist "$APP/Contents/Info.plist"
cp AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"   # made by tools/make-icon.swift (README)
# Admin link (0138): Supabase URL + publishable key (public) and media base URL, from the git-ignored env file
ENV=../storefront/.supabase.env
if [ -f "$ENV" ]; then
  URL=$(grep '^SUPABASE_URL=' "$ENV" | cut -d= -f2- | tr -d '"')
  KEY=$(grep '^SUPABASE_PUBLISHABLE_KEY=' "$ENV" | cut -d= -f2- | tr -d '"')
  MEDIA=$(sed -n 's/.*"mediaBaseUrl": *"\([^"]*\)".*/\1/p' ../storefront/site.json)
  /usr/libexec/PlistBuddy -c "Add :HighmuzikSupabaseURL string $URL" -c "Add :HighmuzikSupabaseKey string $KEY" -c "Add :HighmuzikMediaBaseURL string $MEDIA" "$APP/Contents/Info.plist"
fi
# Ad-hoc signature with a fixed designated requirement (the bundle id): the Keychain's "Always Allow" for the
# admin session stays valid across rebuilds (with the default cdhash requirement every build was a new app and asked again)
codesign --force --sign - -r='designated => identifier "com.highmuzik.scanner"' "$APP"
echo "Built $APP"
