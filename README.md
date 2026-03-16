# Joplin Folder Note Plugin

This is my second Joplin plugin. I have created it with the intention of learning how to create plugins for Joplin, and I hope it can be useful for others as well.
The development has been done using the [Joplin Plugin Generator](https://github.com/laurent22/joplin/tree/dev/packages/generator-joplin) and the help of [Cline](https://cline.bot/).

The plugin has been inspired by the "[Folder Note Plugin](https://github.com/xpgo/obsidian-folder-note-plugin)"  for Obsidian, which I have been using for a while and found it very useful.

The plugin creates special "folder notes" (index notes) for your notebooks, automatically generating a hierarchical overview with clickable links to all subnotebooks and notes within a folder.

## Features

### 📁 Automatic Folder Note Creation
- Creates a special index note with an underscore prefix (e.g., `_MyNotebook`) for each notebook and its direct subnotebooks
- Provides a centralized overview of all content within a folder

### 🔗 Smart Hierarchical Linking
- **Subnotebooks Section**: Lists all child notebooks with direct links to their folder notes
- **Notes Section**: Lists all notes within the current notebook with direct links
- All items are automatically sorted alphabetically for easy navigation

### 🔄 Intelligent Content Updates
- Detects when the folder structure has changed (notes added/removed/renamed, subnotebooks modified)
- Prompts you before updating to protect your custom content
- Preserves any user-added content when updating the structure

### 📝 Content Preservation
When updating folder notes, the plugin intelligently preserves:
- Custom content added before the Subnotebooks section
- Custom content added after the Notes section
- Only the automated lists (Subnotebooks and Notes) are regenerated

### 🎯 Seamless Integration
- Adds a folder icon button to the editor toolbar for quick access
- Works with the currently selected notebook
- Automatically creates folder notes for subnotebooks when needed

## Usage

### Creating a Folder Note

1. Select the notebook you want to create a folder note for
2. Click the folder icon button in the editor toolbar (or use the command palette: `Folder Note`)
3. The plugin will create a note named `_[NotebookName]` containing:
   - A header with the notebook name
   - A "Subnotebooks:" section with links to child notebooks
   - A "Notes:" section with links to all notes in the notebook

### Example Folder Note Structure

```markdown
# Content of My Project

## Subnotebooks:
- [Documentation](:/<note-id>)
- [Resources](:/<note-id>)
- [Tasks](:/<note-id>)

## Notes:
- [Meeting Notes 2024-01-15](:/<note-id>)
- [Project Overview](:/<note-id>)
- [Quick References](:/<note-id>)
```

### Updating Folder Notes

When you click the folder button on an existing folder note (or an any other note in the same notebook):
- If the content is still accurate (no structural changes), the note simply opens
- If the structure has changed (notes/subnotebooks added, removed, or renamed), you'll be prompted:
  - **Yes**: Update the lists while preserving your custom content
  - **No**: Open the note without updating

### Adding Custom Content

You can add custom content to your folder notes:
- **Before the Subnotebooks section**: Add an overview, description, or any introductory content
- **After the Notes section**: Add additional information, links, or notes

This content will be preserved when the plugin updates the folder structure.

## How It Works

1. **Detection**: When you activate the plugin on a notebook, it checks if a folder note already exists
2. **Creation**: If no folder note exists, it creates one with the current structure
3. **Validation**: If a folder note exists, it validates whether the structure is still accurate
4. **Update Prompt**: If changes are detected, you're asked whether to update
5. **Preservation**: During updates, your custom content is preserved while the lists are regenerated
6. **Cascading**: For subnotebooks, the plugin creates placeholder folder notes that you can populate later

## Support

If you encounter any issues or have suggestions for improvements, please file an issue on the GitHub repository.

## Future plans
- Link to notes in Wikilink-Format (if Wikilinks plugin is installed and enabled)
- Add an option to automatically update folder notes without prompting (with a setting to enable/disable this behavior)
- Add an option to customize the prefix used for folder notes (currently hardcoded as an underscore)
- Add an option to customize the text used for the "Subnotebooks" and "Notes" sections
- Create folder notes recursively for all subnotebooks
- Add a setting to choose whether to include subnotebooks in the folder note or not
- Add a setting to choose whether to include notes in the folder note or not
- Add a setting to choose whether to sort the lists alphabetically or by creation date
- Add a timestamp to the folder note indicating when it was last updated
- Make the folder note look pretty with some styling (e.g., using emojis, colors, or icons)
---


**Note**: The folder note (index note) is identified by the underscore prefix in its title. Renaming or removing this prefix may cause the plugin to create a new folder note instead of updating the existing one.