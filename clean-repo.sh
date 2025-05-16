#!/bin/bash

# Make repository safe to push to GitHub
echo "Creating a clean branch from the current state..."

# Add .gitignore to staging
git add .gitignore

# Commit the .gitignore file
git commit -m "Add .gitignore to exclude sensitive files"

# Create a new branch without the history
git checkout --orphan clean-branch

# Add all files to the new branch
git add .

# Commit all files
git commit -m "Initial clean commit"

# Remove the old main branch
git branch -D main

# Rename the current branch to main
git branch -m main

echo "Clean branch created. Please check the repository before pushing."
echo "To push the clean branch, use: git push -f origin main" 