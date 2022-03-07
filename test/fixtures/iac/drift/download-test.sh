#!/bin/env bash
echo -n "download ok" >&2
# We exit in failure here to prevent driftctl fmt to be launched
# The goal in this test is only to test that the file has been downloaded
# and launched successfully
exit 2