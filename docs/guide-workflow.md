# 작업 흐름 (git, 브랜치, 배포)

[← README로 돌아가기](../README.md)

이 문서는 유지보수자용입니다. 컴퓨터를 옮기거나, 브랜치를 어떻게 운영하는지, 배포가 어떻게 되는지 헷갈릴 때 여기를 봅니다.

---

## 💻 다른 컴퓨터에서 이어가기

이 저장소는 GitHub(`origin`)에 올라가 있어서, 다른 컴퓨터에서도 이어서 작업할 수 있습니다.

**처음 받는 컴퓨터라면:**
```powershell
git clone https://github.com/Yoo-Jeong/troubleshooter.git
cd troubleshooter
```

**이미 클론해둔 컴퓨터로 돌아왔다면:**
```powershell
git pull
```

그다음:

1. [🖥 로컬에서 사이트 켜는 법](../README.md#-로컬에서-사이트-켜는-법-미리보기)대로 Ruby와 Jekyll을 설치합니다.  
   컴퓨터마다 한 번만 하면 됩니다.
2. `jekyll serve --livereload`로 켜서 확인합니다.
3. 작업이 끝나면 그 컴퓨터에서 직접 `git add`, `git commit`, `git push`로 GitHub에 올립니다.  
   그래야 다른 컴퓨터에서 `git pull` 했을 때 받아집니다.

---

## 🌿 브랜치 운영

`main`은 [아래 배포](#-배포-github-pages)에서 보듯 push되는 순간 실제 사이트에 반영되는 브랜치입니다.

그래서 평소 작업은 `main`에 바로 하지 않습니다.  
대신 **`dev`(개발) 브랜치**에서 작업하다가, 방문자에게 보여줘도 될 만큼 정리됐을 때만 `main`으로 옮깁니다.

### 평소 작업 흐름

1. `dev` 브랜치에서 작업하고 그대로 `git commit`합니다.  
   필요하면 `git push origin dev`로 원격에도 백업할 수 있습니다.  
   `dev`에 push해도 배포 워크플로는 `main`만 보기 때문에 사이트에는 영향이 없습니다.
2. 미완성이거나 실험적인 내용이 섞여 있어도 상관없습니다.  
   방문자는 배포된 `main`만 보니까요.

### 공개(배포)하고 싶을 때

1. `dev`가 정리된 상태인지 확인합니다. 로컬에서 `jekyll serve`로 미리 볼 수 있습니다.
2. `main`으로 옮기는 방법은 둘 중 편한 쪽으로 합니다.

   **간단하게, 로컬에서 병합**
   ```powershell
   git checkout main
   git merge dev
   git push
   ```
   이 `push`가 배포를 트리거합니다.

   **기록을 남기며, GitHub PR**  
   GitHub에서 `dev`에서 `main`으로 Pull Request를 만들고 병합합니다.  
   무엇을 언제 공개했는지 이력이 GitHub에 남아서, 나중에 그때 뭘 올렸는지 되짚기 편합니다.  
   `main` merge 자체가 곧 배포라서 CI 통과를 기다리는 절차는 따로 없습니다.

### 처음 한 번만 하는 `dev` 브랜치 만들기

```powershell
git checkout -b dev
git push -u origin dev
```

이후로는 `git checkout dev`로 돌아와 평소처럼 작업하면 됩니다.

> 💡 GitHub 저장소 **Settings → Branches**에서 `main`에 **Pull Request 필수** 규칙을 걸어두면,  
> `main`에 실수로 직접 push하는 상황을 막을 수 있습니다. 지금처럼 혼자 작업할 땐 없어도 됩니다.

---

## 🚀 배포 (GitHub Pages)

이 저장소는 **public**이고, `main` 브랜치에 push되면 **GitHub Actions**가 자동으로 빌드하고 배포합니다.

실제 사이트 주소: **https://yoo-jeong.github.io/troubleshooter/**

- 워크플로 파일은 `.github/workflows/pages.yml`입니다.  
  GitHub이 기본 제공하는 Jekyll 빌드 대신, 로컬과 똑같이 `jekyll build`를 그대로 실행해 `_site`를 배포합니다.
  > 이유는 GitHub 기본 빌드가 `_config.yml`의 `source: src` 설정을 무시하는 알려진 문제가 있기 때문입니다.  
  > 저장소 루트를 그대로 빌드해버려서 `README.md`가 홈페이지로 뜨는 등 오작동합니다.
- 저장소 **Settings → Pages → Source**가 반드시 **`GitHub Actions`**로 설정돼 있어야 합니다.  
  `Deploy from a branch`로 두면 GitHub이 자체 레거시 빌드를 돌려 위 문제가 다시 생깁니다.
- 사이트가 `username.github.io/저장소이름/`처럼 하위경로에 배포됩니다.  
  그래서 코드에서 링크는 항상 상대경로만 씁니다(`../`, `characters/slug/` 등).  
  절대경로(`/assets/...`)를 쓰면 하위경로 배포에서 깨집니다.  
  `common.js`의 `TSROOT()`(로고 클릭, 설정 패널 링크가 쓰는 사이트 루트 계산 함수)도 이 원칙으로 만들어져 있습니다.
- 배포는 `main` push에만 반응합니다. `workflow_dispatch`로 Actions 탭에서 수동 실행도 가능합니다.  
  개발 중인 다른 브랜치에 push해도 사이트에는 영향 없습니다. 위 [🌿 브랜치 운영](#-브랜치-운영) 참고.
