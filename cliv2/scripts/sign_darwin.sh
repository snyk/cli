#!/usr/bin/env bash
set -euo pipefail

# expected environment variables
#APPLE_ID=AAA
#APPLE_APP_PASSWORD=BBB
#APPLE_TEAM_ID=CCC
#APPLE_SIGNING_IDENTITY="DDD"
#APPLE_SIGNING_SECRETS_BINARY=EEE....
#APPLE_SIGNING_SECRETS_PASSWORD=FFF

EXPORT_PATH=${1:-./bin}
PRODUCT_NAME=${2:-snyk_darwin_amd64}
KEYCHAIN_PROFILE=AC_PASSWORD
APP_PATH="$EXPORT_PATH/$PRODUCT_NAME"
ZIP_PATH="$EXPORT_PATH/$PRODUCT_NAME.zip"
#DMG_PATH="$EXPORT_PATH/$PRODUCT_NAME.dmg"
APPLE_SIGNING_SECRETS="AppleCodeSigningSecrets.p12"
KEYCHAIN_NAME=CodeSigningChain
KEYCHAIN_PASSWORD=123456
KEYCHAIN_FILE="$HOME/Library/Keychains/$KEYCHAIN_NAME-db"
OLD_KEYCHAIN_NAMES=$(security list-keychains | sed -E -e ':a' -e 'N' -e '$!ba' -e 's/\n//g' -e 's/ //g' -e 's/""/" "/g')

LOG_PREFIX="--- $(basename "$0"):"

echo "$LOG_PREFIX Signing & notarizing \"$APP_PATH\""

if [[ "$OSTYPE" != *"darwin"* ]]; then
  echo "$LOG_PREFIX ERROR! This script needs to be run on macOS!"
  exit 1
fi

#
# signing
#
echo "$LOG_PREFIX Creating p12 file"
echo "$APPLE_SIGNING_SECRETS_BINARY" | base64 --decode > "$APPLE_SIGNING_SECRETS"

echo "$LOG_PREFIX Adding temporary keychain"
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_NAME"
security list-keychains -s "$KEYCHAIN_NAME"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_NAME"

# import signing secrets into key chain
echo "$LOG_PREFIX Importing p12 file into temporary keychain"
security import "$APPLE_SIGNING_SECRETS" -P "$APPLE_SIGNING_SECRETS_PASSWORD" -k "$KEYCHAIN_NAME" -T /usr/bin/codesign
rm $APPLE_SIGNING_SECRETS
security set-key-partition-list -S apple-tool:,apple: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_NAME"

echo "$LOG_PREFIX Signing binary $APP_PATH"
codesign -s "$APPLE_SIGNING_IDENTITY" -v "$APP_PATH" --options runtime

#
# notarization
#

# create a zip file
echo "$LOG_PREFIX Creating zip file $ZIP_PATH"
/usr/bin/ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

# add notarization credentials to keychain for later usage
echo "$LOG_PREFIX Preparing notarization"
xcrun notarytool store-credentials "$KEYCHAIN_PROFILE" --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_APP_PASSWORD" --keychain "$KEYCHAIN_FILE"

# notarize & wait
echo "$LOG_PREFIX Running notarization"
xcrun notarytool submit "$ZIP_PATH" --keychain-profile "$KEYCHAIN_PROFILE" --wait

# note: currently creating a DMG is disabled, since we experienced issues running it n the CircleCi VM
# create dmg
#echo "$LOG_PREFIX Creating DMG file $DMG_PATH"
#hdiutil create -volname "$PRODUCT_NAME" -srcfolder "$APP_PATH" -ov -format UDZO "$DMG_PATH"
#xcrun notarytool submit "$DMG_PATH" --keychain-profile "$KEYCHAIN_PROFILE" --wait
# ONLY for .dmg - Staple
#xcrun stapler staple "$DMG_PATH"

# cleanup 
echo "$LOG_PREFIX Cleaning up"
security list-keychains -s "$OLD_KEYCHAIN_NAMES"
security delete-keychain "$KEYCHAIN_NAME"
