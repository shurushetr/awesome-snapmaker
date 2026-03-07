# Deployment & Setup Guide

This guide will walk you through the steps to get your Awesome Snapmaker list live on the internet using **GitHub Pages** and how to enable the **GitHub Actions** that power the automations you just built.

## Step 1: Push your code to GitHub
If you haven't already, push all the files in this folder to your GitHub repository (`shurushetr/awesome-snapmaker`).

```bash
git add .
git commit -m "Initial commit of awesome list frontend and automations"
git push origin main
```

*(Note: Depending on your default branch name, it might be `master` instead of `main`.)*

## Step 2: Enable GitHub Actions (Permissions)
The automated workflows (like accepting Issue form submissions and regenerating the README) need permission to write to your repository on your behalf.

1. Go to your repository on GitHub.
2. Click on the **Settings** tab.
3. In the left sidebar, click on **Actions** -> **General**.
4. Scroll down to the **Workflow permissions** section.
5. Select **Read and write permissions**.
6. Check the box that says **Allow GitHub Actions to create and approve pull requests**.
7. Click **Save**.

## Step 3: Enable GitHub Pages
This step makes the beautiful interactive web interface live.

1. Still in the repository **Settings** tab.
2. In the left sidebar, click on **Pages**.
3. Under the **Build and deployment** section:
   - Make sure **Source** is set to **Deploy from a branch**.
   - Under **Branch**, select your main branch (e.g., `main` or `master`).
   - Leave the folder dropdown as `/ (root)`.
   - Click **Save**.
4. GitHub will now start building your web page. It usually takes 1-2 minutes.
5. Once finished, a notification will appear at the top of the Pages settings with your live link (e.g., `https://shurushetr.github.io/awesome-snapmaker/`).

## Step 4: Test the Workflow!
Now that everything is live, let's test it to make sure the automations work.

1. Go to the **Issues** tab in your repository.
2. Click **New issue**.
3. You should see a shiny new button: **Submit a Awesome Resource**. Click **Get started**.
4. Fill out the form with dummy data (or a real resource).
5. Click **Submit new issue**.
6. Switch to the **Actions** tab. You'll see the "Process New Submission" workflow running.
7. Once the action finishes (takes ~15 seconds), check the **Pull requests** tab. There will be an automated PR ready for you to review!
8. Merge the PR. This will automatically trigger the "Generate README" action, updating your repo's front page.

## Maintenance Notes
- **Editing data manually**: You can edit `data.yml` manually anytime. As soon as you commit the changes, the README generator will run automatically, and GitHub Pages will update the website.
- **Adding new tags**: If you want to add a new `Machine Type` or `Category` in the future:
  1. Add it to the options in `.github/ISSUE_TEMPLATE/submit-resource.yml`
  2. Add it to the `TAGS` dictionary at the top of `app.js`
  3. (No changes needed in the Python scripts!)
