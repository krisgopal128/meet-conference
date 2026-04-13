#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /home/jspace/meet-conference/meet-backend
npx tsc --noEmit 2>&1 | head -20
