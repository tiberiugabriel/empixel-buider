# Contributing to EmPixel Builder Plugin

First off, thank you for considering contributing to this project! It's people like you that make the open-source community such a great place to learn, inspire, and create.

## 🛑 Before You Write Code

To prevent wasted time and effort, **please open an issue to discuss your proposed changes before writing any code.** We want to ensure your work aligns with the project's roadmap and architectural vision. Unsolicited Pull Requests with large new features without prior discussion may be closed.

## 🚀 Getting Started Locally

To test the plugin and make changes, you'll need to set up the project on your local machine:

1. **Fork the repository** to your own GitHub account using the "Fork" button at the top right.
2. **Clone the repository** to your local machine:
   ```bash
   git clone https://github.com/tiberiugabriel/empixel-buider.git
   cd empixel-builder
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Run the development server** (this will start the Astro/EmDash test environment):
   ```bash
   npm run dev
   ```

## 🌿 Branching Strategy

Please create a new branch for your changes directly from `main`. Use a descriptive name based on the type of work:
- `feat/your-feature-name` (for new features)
- `fix/your-bug-fix` (for bug fixes)
- `docs/what-you-changed` (for documentation updates)

## ✍️ Commit Guidelines

We encourage following [Conventional Commits](https://www.conventionalcommits.org/). Please ensure your commit messages are clear and follow this basic structure:
- `feat: add new image widget`
- `fix: resolve alignment issue in flex container`
- `docs: update setup instructions`

## 🔄 Pull Request Process

1. Ensure your code follows the existing style and architecture.
2. Run `npm run lint` and `npm run build` locally to ensure no tests or builds fail.
3. Push your branch to your fork.
4. Open a Pull Request against the `main` branch of this repository.
5. Fill out the **Pull Request Template** completely.
6. Wait for a maintainer to review your code. We usually review PRs over the weekend. Please be patient!

## 📜 Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md). We expect all contributors to maintain a respectful, inclusive, and welcoming environment for everyone.