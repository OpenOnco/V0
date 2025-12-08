#!/bin/bash

# Ask user for hours
read -p "Enter the number of hours to go back: " hours

# Validate input is a positive integer
if ! [[ "$hours" =~ ^[0-9]+$ ]] || [ "$hours" -eq 0 ]; then
    echo "Error: Please enter a positive integer."
    exit 1
fi

# Find the latest commit that's at least X hours old for the specific file
commit=$(git log --since="${hours} hours ago" --until="now" --format="%H" -- ./src/App.jsx | tail -1)

# If no commit found in that range, get the latest commit before X hours ago
if [ -z "$commit" ]; then
    commit=$(git log --until="${hours} hours ago" -1 --format="%H" -- ./src/App.jsx)
fi

if [ -z "$commit" ]; then
    echo "Error: No commit found for ./src/App.jsx that's at least $hours hours old."
    exit 1
fi

# Get the commit date for display
commit_date=$(git log -1 --format="%ci" "$commit")

echo "Found commit: $commit"
echo "Commit date: $commit_date"

# Extract the file and save to ~/Downloads
git show "$commit:./src/App.jsx" > ~/Downloads/App.jsx

if [ $? -eq 0 ]; then
    echo "Successfully restored App.jsx to ~/Downloads/App.jsx"
else
    echo "Error: Failed to extract file from commit."
    exit 1
fi
