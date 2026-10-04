# StackBlitz Deployment Reference for UAT

## Overview
StackBlitz WebContainers provide a zero-infrastructure, browser-based runtime that executes Node.js, Vite, and static web apps directly inside the browser using WebAssembly.

---

## Direct POST API Specification
To launch a project dynamically without committing to GitHub or setting up cloud accounts, use the `https://stackblitz.com/run` POST endpoint.

### Form Fields:
* `project[title]`: String (e.g. `My Application - UAT Sandbox`)
* `project[description]`: String (e.g. `Temporary UAT review container`)
* `project[template]`: String (`html`, `javascript`, or `node`)
* `project[tags][]`: Array of strings
* `project[files][<path>]`: Content string of each project file

---

## Standard Launcher Implementation
Agents should generate `open_stackblitz.html` and `redirect_stackblitz.html` in the target project root using this structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Opening StackBlitz UAT Sandbox...</title>
</head>
<body>
  <h2>⚡ Opening UAT Sandbox in StackBlitz...</h2>
  <form id="sbForm" action="https://stackblitz.com/run" method="POST">
    <input type="hidden" name="project[title]" value="Project Title">
    <input type="hidden" name="project[template]" value="html">
    <input type="hidden" name="project[files][index.html]" value="...">
    <!-- Additional files -->
  </form>
  <script>
    window.addEventListener('DOMContentLoaded', () => {
      document.getElementById('sbForm').submit();
    });
  </script>
</body>
</html>
```
