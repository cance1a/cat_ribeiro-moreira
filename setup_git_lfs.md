
Windows (choco): choco install git-lfs

git lfs install

git lfs track "assets/img/**/*.jpg"
git lfs track "assets/img/**/*.jpeg"
git lfs track "assets/img/**/*.png"
git lfs track "assets/img/**/*.gif"

git add .gitattributes

git add assets/img
git commit -m "Adiciona imagens com Git LFS"
git push

git add assets/img
git commit -m "Atualiza imagens"
git push