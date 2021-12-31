#!/bin/bash
#
#   Copyright 2017 Marco Vermeulen
#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.
#

# install:- channel: stable; version: 5.13.1; api: https://api.sdkman.io/2

# Global variables
SDKMAN_SERVICE="https://api.sdkman.io/2"
SDKMAN_VERSION="5.13.1"
SDKMAN_PLATFORM=$(uname)

if [ -z "$SDKMAN_DIR" ]; then
    SDKMAN_DIR="$HOME/.sdkman"
    SDKMAN_DIR_RAW='$HOME/.sdkman'
else
    SDKMAN_DIR_RAW="$SDKMAN_DIR"
fi

# Local variables
sdkman_tmp_folder="${SDKMAN_DIR}/tmp"
sdkman_zip_file="${sdkman_tmp_folder}/sdkman-${SDKMAN_VERSION}.zip"
sdkman_zip_base_folder="${sdkman_tmp_folder}/sdkman-${SDKMAN_VERSION}"
sdkman_ext_folder="${SDKMAN_DIR}/ext"
sdkman_etc_folder="${SDKMAN_DIR}/etc"
sdkman_var_folder="${SDKMAN_DIR}/var"
sdkman_archives_folder="${SDKMAN_DIR}/archives"
sdkman_candidates_folder="${SDKMAN_DIR}/candidates"
sdkman_config_file="${sdkman_etc_folder}/config"
sdkman_bash_profile="${HOME}/.bash_profile"
sdkman_profile="${HOME}/.profile"
sdkman_bashrc="${HOME}/.bashrc"
sdkman_zshrc="${ZDOTDIR:-${HOME}}/.zshrc"

sdkman_init_snippet=$( cat << EOF
#THIS MUST BE AT THE END OF THE FILE FOR SDKMAN TO WORK!!!
export SDKMAN_DIR="$SDKMAN_DIR_RAW"
[[ -s "${SDKMAN_DIR_RAW}/bin/sdkman-init.sh" ]] && source "${SDKMAN_DIR_RAW}/bin/sdkman-init.sh"
EOF
)

# OS specific support (must be 'true' or 'false').
cygwin=false;
darwin=false;
solaris=false;
freebsd=false;
case "$(uname)" in
    CYGWIN*)
        cygwin=true
        ;;
    Darwin*)
        darwin=true
        ;;
    SunOS*)
        solaris=true
        ;;
    FreeBSD*)
        freebsd=true
esac


echo ''
echo '                                -+syyyyyyys:'
echo '                            `/yho:`       -yd.'
echo '                         `/yh/`             +m.'
echo '                       .oho.                 hy                          .`'
echo '                     .sh/`                   :N`                `-/o`  `+dyyo:.'
echo '                   .yh:`                     `M-          `-/osysoym  :hs` `-+sys:      hhyssssssssy+'
echo '                 .sh:`                       `N:          ms/-``  yy.yh-      -hy.    `.N-````````+N.'
echo '               `od/`                         `N-       -/oM-      ddd+`     `sd:     hNNm        -N:'
echo '              :do`                           .M.       dMMM-     `ms.      /d+`     `NMMs       `do'
echo '            .yy-                             :N`    ```mMMM.      -      -hy.       /MMM:       yh'
echo '          `+d+`           `:/oo/`       `-/osyh/ossssssdNMM`           .sh:         yMMN`      /m.'
echo '         -dh-           :ymNMMMMy  `-/shmNm-`:N/-.``   `.sN            /N-         `NMMy      .m/'
echo '       `oNs`          -hysosmMMMMydmNmds+-.:ohm           :             sd`        :MMM/      yy'
echo '      .hN+           /d:    -MMMmhs/-.`   .MMMh   .ss+-                 `yy`       sMMN`     :N.'
echo '     :mN/           `N/     `o/-`         :MMMo   +MMMN-         .`      `ds       mMMh      do'
echo '    /NN/            `N+....--:/+oooosooo+:sMMM:   hMMMM:        `my       .m+     -MMM+     :N.'
echo '   /NMo              -+ooooo+/:-....`...:+hNMN.  `NMMMd`        .MM/       -m:    oMMN.     hs'
echo '  -NMd`                                    :mm   -MMMm- .s/     -MMm.       /m-   mMMd     -N.'
echo ' `mMM/                                      .-   /MMh. -dMo     -MMMy        od. .MMMs..---yh'
echo ' +MMM.                                           sNo`.sNMM+     :MMMM/        sh`+MMMNmNm+++-'
echo ' mMMM-                                           /--ohmMMM+     :MMMMm.       `hyymmmdddo'
echo ' MMMMh.                  ````                  `-+yy/`yMMM/     :MMMMMy       -sm:.``..-:-.`'
echo ' dMMMMmo-.``````..-:/osyhddddho.           `+shdh+.   hMMM:     :MmMMMM/   ./yy/` `:sys+/+sh/'
echo ' .dMMMMMMmdddddmmNMMMNNNNNMMMMMs           sNdo-      dMMM-  `-/yd/MMMMm-:sy+.   :hs-      /N`'
echo '  `/ymNNNNNNNmmdys+/::----/dMMm:          +m-         mMMM+ohmo/.` sMMMMdo-    .om:       `sh'
echo '     `.-----+/.`       `.-+hh/`         `od.          NMMNmds/     `mmy:`     +mMy      `:yy.'
echo '           /moyso+//+ossso:.           .yy`          `dy+:`         ..       :MMMN+---/oys:'
echo '         /+m:  `.-:::-`               /d+                                    +MMMMMMMNh:`'
echo '        +MN/                        -yh.                                     `+hddhy+.'
echo '       /MM+                       .sh:'
echo '      :NMo                      -sh/'
echo '     -NMs                    `/yy:'
echo '    .NMy                  `:sh+.'
echo '   `mMm`               ./yds-'
echo '  `dMMMmyo:-.````.-:oymNy:`'
echo '  +NMMMMMMMMMMMMMMMMms:`'
echo '    -+shmNMMMNmdy+:`'
echo ''
echo ''
echo '                                                                 Now attempting installation...'
echo ''
echo ''

# Sanity checks

echo "Looking for a previous installation of SDKMAN..."
if [ -d "$SDKMAN_DIR" ]; then
	echo "SDKMAN found."
	echo ""
	echo "======================================================================================================"
	echo " You already have SDKMAN installed."
	echo " SDKMAN was found at:"
	echo ""
	echo "    ${SDKMAN_DIR}"
	echo ""
	echo " Please consider running the following if you need to upgrade."
	echo ""
	echo "    $ sdk selfupdate force"
	echo ""
	echo "======================================================================================================"
	echo ""
	exit 0
fi

echo "Looking for unzip..."
if ! command -v unzip > /dev/null; then
	echo "Not found."
	echo "======================================================================================================"
	echo " Please install unzip on your system using your favourite package manager."
	echo ""
	echo " Restart after installing unzip."
	echo "======================================================================================================"
	echo ""
	exit 1
fi

echo "Looking for zip..."
if ! command -v zip > /dev/null; then
	echo "Not found."
	echo "======================================================================================================"
	echo " Please install zip on your system using your favourite package manager."
	echo ""
	echo " Restart after installing zip."
	echo "======================================================================================================"
	echo ""
	exit 1
fi

echo "Looking for curl..."
if ! command -v curl > /dev/null; then
	echo "Not found."
	echo ""
	echo "======================================================================================================"
	echo " Please install curl on your system using your favourite package manager."
	echo ""
	echo " Restart after installing curl."
	echo "======================================================================================================"
	echo ""
	exit 1
fi

if [[ "$solaris" == true ]]; then
	echo "Looking for gsed..."
	if [ -z $(which gsed) ]; then
		echo "Not found."
		echo ""
		echo "======================================================================================================"
		echo " Please install gsed on your solaris system."
		echo ""
		echo " SDKMAN uses gsed extensively."
		echo ""
		echo " Restart after installing gsed."
		echo "======================================================================================================"
		echo ""
		exit 1
	fi
else
	echo "Looking for sed..."
	if [ -z $(command -v sed) ]; then
		echo "Not found."
		echo ""
		echo "======================================================================================================"
		echo " Please install sed on your system using your favourite package manager."
		echo ""
		echo " Restart after installing sed."
		echo "======================================================================================================"
		echo ""
		exit 1
	fi
fi


echo "Installing SDKMAN scripts..."


# Create directory structure

echo "Create distribution directories..."
mkdir -p "$sdkman_tmp_folder"
mkdir -p "$sdkman_ext_folder"
mkdir -p "$sdkman_etc_folder"
mkdir -p "$sdkman_var_folder"
mkdir -p "$sdkman_archives_folder"
mkdir -p "$sdkman_candidates_folder"

echo "Getting available candidates..."
SDKMAN_CANDIDATES_CSV=$(curl -s "${SDKMAN_SERVICE}/candidates/all")
echo "$SDKMAN_CANDIDATES_CSV" > "${SDKMAN_DIR}/var/candidates"

echo "Prime the config file..."
touch "$sdkman_config_file"
echo "sdkman_auto_answer=false" >> "$sdkman_config_file"
if [ -z "$ZSH_VERSION" -a -z "$BASH_VERSION" ]; then
    echo "sdkman_auto_complete=false" >> "$sdkman_config_file"
else
    echo "sdkman_auto_complete=true" >> "$sdkman_config_file"
fi
echo "sdkman_auto_env=false" >> "$sdkman_config_file"
echo "sdkman_beta_channel=false" >> "$sdkman_config_file"
echo "sdkman_colour_enable=true" >> "$sdkman_config_file"
echo "sdkman_curl_connect_timeout=7" >> "$sdkman_config_file"
echo "sdkman_curl_max_time=10" >> "$sdkman_config_file"
echo "sdkman_debug_mode=false" >> "$sdkman_config_file"
echo "sdkman_insecure_ssl=false" >> "$sdkman_config_file"
echo "sdkman_rosetta2_compatible=false" >> "$sdkman_config_file"
echo "sdkman_selfupdate_enable=true" >> "$sdkman_config_file"

echo "Download script archive..."
curl --location --progress-bar "${SDKMAN_SERVICE}/broker/download/sdkman/install/${SDKMAN_VERSION}/${SDKMAN_PLATFORM}" > "$sdkman_zip_file"

ARCHIVE_OK=$(unzip -qt "$sdkman_zip_file" | grep 'No errors detected in compressed data')
if [[ -z "$ARCHIVE_OK" ]]; then
	echo "Downloaded zip archive corrupt. Are you connected to the internet?"
	echo ""
	echo "If problems persist, please ask for help on our Slack:"
	echo "* easy sign up: https://slack.sdkman.io/"
	echo "* report on channel: https://sdkman.slack.com/app_redirect?channel=user-issues"
	rm -rf "$SDKMAN_DIR"
	exit 1
fi

echo "Extract script archive..."
if [[ "$cygwin" == 'true' ]]; then
	echo "Cygwin detected - normalizing paths for unzip..."
	sdkman_tmp_folder=$(cygpath -w "$sdkman_tmp_folder")
	sdkman_zip_file=$(cygpath -w "$sdkman_zip_file")
	sdkman_zip_base_folder=$(cygpath -w "$sdkman_zip_base_folder")
fi
unzip -qo "$sdkman_zip_file" -d "$sdkman_tmp_folder"

echo "Install scripts..."
mv "${sdkman_zip_base_folder}/"* "$SDKMAN_DIR"
rm -rf "$sdkman_zip_base_folder"

echo "Set version to $SDKMAN_VERSION ..."
echo "$SDKMAN_VERSION" > "${SDKMAN_DIR}/var/version"


echo -e "\n\n\nAll done!\n\n"

echo "Please open a new terminal, or run the following in the existing one:"
echo ""
echo "    source \"${SDKMAN_DIR}/bin/sdkman-init.sh\""
echo ""
echo "Then issue the following command:"
echo ""
echo "    sdk help"
echo ""
echo "Enjoy!!!"
