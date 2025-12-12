#!/bin/bash

# Ask user for hours
read -p "Enter the number of hours to go back: " hours

# Validate input is a positive integer
if ! [[ "$hours" =~ ^[0-9]+$ ]] || [ "$hours" -eq 0 ]; then
    echo "Error: Please enter a positive integer."
    exit 1
fi

# Find the oldest commit within the last X hours for the specific file
commit=$(git log --since="${hours} hours ago" --until="now" --format="%H" -- ./api/chat.js | tail -1)

if [ -z "$commit" ]; then
    echo "Error: No commit found for ./api/chat.js within the last $hours hours."
    exit 1
fi

# Get the commit date for display
commit_date=$(git log -1 --format="%ci" "$commit")

echo "Found commit: $commit"
echo "Commit date: $commit_date"

# Ask for confirmation
read -p "Restore this version? (y/n): " confirm

if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 0
fi

# Extract the file and save to ~/Downloads
git show "$commit:./api/chat.js" > ~/Downloads/chat.js

if [ $? -eq 0 ]; then
    echo "Successfully restored chat.js to ~/Downloads/chat.js"
else
    echo "Error: Failed to extract file from commit."
    exit 1
fi