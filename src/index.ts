import joplin from 'api';
import { ToolbarButtonLocation } from 'api/types';

// Helper function to parse note body into sections
function parseNoteBody(body: string): { before: string; subnotebooks: string; notes: string; after: string } {
	const subnotebooksMatch = body.match(/([\s\S]*?)(## Subnotebooks:[\s\S]*?)(?=## Notes:|$)/);
	const notesMatch = body.match(/(## Notes:[\s\S]*?)$/);
	
	let before = '';
	let subnotebooks = '';
	let notes = '';
	let after = '';
	
	if (subnotebooksMatch) {
		before = subnotebooksMatch[1].trim();
		subnotebooks = subnotebooksMatch[2].trim();
		
		// Check if there's content after subnotebooks but before notes
		if (notesMatch) {
			notes = notesMatch[1].trim();
			// Get content between subnotebooks and notes
			const afterSubnotebooks = body.substring(subnotebooksMatch[0].length);
			const notesStart = afterSubnotebooks.indexOf('## Notes:');
			if (notesStart > 0) {
				const between = afterSubnotebooks.substring(0, notesStart).trim();
				if (between) {
					before += '\n\n' + between;
				}
			}
		} else {
			// No notes section, check for content after subnotebooks
			const afterSubnotebooks = body.substring(subnotebooksMatch[0].length).trim();
			if (afterSubnotebooks) {
				after = afterSubnotebooks;
			}
		}
	} else if (notesMatch) {
		// No subnotebooks section, but has notes section
		const notesStart = body.indexOf('## Notes:');
		before = body.substring(0, notesStart).trim();
		notes = notesMatch[1].trim();
	}
	
	// Get content after notes section if it exists
	if (notes) {
		const notesStart = body.indexOf('## Notes:');
		const notesSection = body.substring(notesStart);
		const notesLines = notesSection.split('\n');
		let endOfNotes = 1; // Start after "## Notes:" line
		
		// Find where the notes list ends (first non-list line after header)
		for (let i = 1; i < notesLines.length; i++) {
			const line = notesLines[i].trim();
			if (line && !line.startsWith('-')) {
				endOfNotes = i;
				break;
			}
			if (line.startsWith('-')) {
				endOfNotes = i + 1;
			}
		}
		
		if (endOfNotes < notesLines.length) {
			after = notesLines.slice(endOfNotes).join('\n').trim();
		}
	}
	
	return { before, subnotebooks, notes, after };
}

// Helper function to extract links from a section
function extractLinks(section: string): Map<string, string> {
	const links = new Map<string, string>();
	const linkRegex = /\[([^\]]+)\]\(:\/([a-f0-9]+)\)/g;
	let match;
	
	while ((match = linkRegex.exec(section)) !== null) {
		const title = match[1];
		const id = match[2];
		links.set(id, title);
	}
	
	return links;
}

// Helper function to validate if note content is still accurate
function validateNoteContent(
	parsedBody: { before: string; subnotebooks: string; notes: string; after: string },
	currentSubnotebooks: Array<{ id: string; title: string }>,
	currentNotes: Array<{ id: string; title: string }>
): boolean {
	// Extract links from existing sections
	const existingSubnotebookLinks = extractLinks(parsedBody.subnotebooks);
	const existingNoteLinks = extractLinks(parsedBody.notes);
	
	// Check if the counts match
	if (existingSubnotebookLinks.size !== currentSubnotebooks.length) {
		return false; // Number of subnotebooks has changed
	}
	
	if (existingNoteLinks.size !== currentNotes.length) {
		return false; // Number of notes has changed
	}
	
	// For subnotebooks, only validate by title (not ID) because links point to folder notes, not the subnotebook folder itself
	const existingSubnotebookTitles = new Set(Array.from(existingSubnotebookLinks.values()));
	for (const sub of currentSubnotebooks) {
		if (!existingSubnotebookTitles.has(sub.title)) {
			return false;
		}
	}
	
	// For notes, validate both ID and title
	for (const note of currentNotes) {
		const existingTitle = existingNoteLinks.get(note.id);
		if (!existingTitle) {
			return false;
		}
		if (existingTitle !== note.title) {
			return false;
		}
	}
	
	return true; // Content is still valid
}

joplin.plugins.register({
	onStart: async function () {
		// eslint-disable-next-line no-console
		console.info('FolderNote plugin started!');
		
		// Create the update dialog once during initialization
		const updateDialog = await joplin.views.dialogs.create('folderNoteUpdateDialog');
		await joplin.views.dialogs.setButtons(updateDialog, [
			{ id: 'yes', title: 'Yes' },
			{ id: 'no', title: 'No' }
		]);
		await joplin.views.dialogs.setHtml(updateDialog, 
			'<p>The folder structure has changed. Do you want to update the note?</p>'
		);
		
		await joplin.commands.register({
			name: 'openFolderNote',
			label: 'Folder Note',
			iconName: 'fas fa-folder',
			execute: async () => {
				try {
					const folder = await joplin.workspace.selectedFolder();
					if (!folder) {
						console.warn('No folder selected');
						return;
					}

					const folderNoteTitle = `_${folder.title}`;
					let pageNum = 1;
					let foundNoteId = null;
					const allNotes = [];

					// Check if folder note already exists and collect all notes
					while (true) {
						const result = await joplin.data.get(['folders', folder.id, 'notes'], {
							fields: ['id', 'title'],
							page: pageNum,
						});

						if (result.items) {
							for (const note of result.items) {
								if (note.title === folderNoteTitle) {
									foundNoteId = note.id;
								} else {
									// Collect all other notes for the notes list
									allNotes.push(note);
								}
							}
						}

						if (foundNoteId || !result.has_more) break;
						pageNum++;
					}

					// Collect current folder structure for validation
					// Sort notes alphabetically by title (case-insensitive, ascending)
					allNotes.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
					
					// Get child folders (subnotebooks)
					const subnotebooks = [];
					let subPage = 1;
					
					try {
						while (true) {
							const subResult = await joplin.data.get(['folders'], {
								fields: ['id', 'title', 'parent_id'],
								page: subPage,
							});
							
							if (subResult.items) {
								// Filter to only include direct children of the current folder
								const childFolders = subResult.items.filter(f => f.parent_id === folder.id);
								subnotebooks.push(...childFolders);
							}
							
							if (!subResult.has_more) break;
							subPage++;
						}
						
						// Sort subnotebooks alphabetically by title (case-insensitive, ascending)
						subnotebooks.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
					} catch (subError) {
						console.error('Error fetching subnotebooks:', subError);
						// Continue anyway without subnotebook links
					}

					// Check if we should update an existing note
					let shouldUpdate = false;
					let preservedContent = null;
					
					if (foundNoteId) {
						const existingNote = await joplin.data.get(['notes', foundNoteId], {
							fields: ['body'],
						});
						
						if (existingNote.body && existingNote.body.startsWith('automatically generated Note - Content not set yet')) {
							shouldUpdate = true;
						} else {
							// Parse existing note to check if content is still valid
							const parsedBody = parseNoteBody(existingNote.body);
							const isValid = validateNoteContent(parsedBody, subnotebooks, allNotes);
							
							if (isValid) {
								// Open the existing note
								await joplin.commands.execute('openNote', foundNoteId);
								return;
							}
							
							// Content is outdated, ask user if they want to update
							const result = await joplin.views.dialogs.open(updateDialog);
							
							if (result.id === 'yes') {
								shouldUpdate = true;
								preservedContent = parsedBody;
							} else {
								// Open the existing note without updating
								await joplin.commands.execute('openNote', foundNoteId);
								return;
							}
						}
					}

					if (!foundNoteId || shouldUpdate) {
						// Build the note body with subnotebook links
						let noteBody = '';
						
						// If preserving content, start with the "before" section
						if (preservedContent) {
							noteBody = preservedContent.before;
						} else {
							noteBody = `# Content of ${folder.title}`;
						}
						
						// Add subnotebook links if any exist
						if (subnotebooks.length > 0) {
							noteBody += '\n\n## Subnotebooks:\n';
							for (const subnotebook of subnotebooks) {
								// Search for the folder note (index note) within the subnotebook
								const folderNoteTitle = `_${subnotebook.title}`;
								let folderNoteId = null;
								let subNotePageNum = 1;
								
								try {
									while (true) {
										const subNotesResult = await joplin.data.get(['folders', subnotebook.id, 'notes'], {
											fields: ['id', 'title'],
											page: subNotePageNum,
										});
										
										if (subNotesResult.items) {
											const foundNote = subNotesResult.items.find(note => note.title === folderNoteTitle);
											if (foundNote) {
												folderNoteId = foundNote.id;
												break;
											}
										}
										
										if (!subNotesResult.has_more) break;
										subNotePageNum++;
									}
									
									// If folder note doesn't exist, create it
									if (!folderNoteId) {
										const newFolderNote = await joplin.data.post(['notes'], null, {
											title: folderNoteTitle,
											body: 'automatically generated Note - Content not set yet',
											parent_id: subnotebook.id,
										});
										folderNoteId = newFolderNote.id;
									}
									
									// Create link to the folder note
									noteBody += `- [${subnotebook.title}](:/${folderNoteId})\n`;
								} catch (subNoteError) {
									console.error(`Error processing subnotebook ${subnotebook.title}:`, subNoteError);
									// Fallback: just add the subnotebook title without a link
									noteBody += `- ${subnotebook.title} (error creating link)\n`;
								}
							}
						}
						
						// Add notes links if any exist
						if (allNotes.length > 0) {
							noteBody += '\n\n## Notes:\n';
							for (const note of allNotes) {
								noteBody += `- [${note.title}](:/${note.id})\n`;
							}
						}
						
						// If preserving content, append the "after" section
						if (preservedContent && preservedContent.after) {
							noteBody += '\n\n' + preservedContent.after;
						}
						
						if (shouldUpdate) {
							// Update existing folder note
							await joplin.data.put(['notes', foundNoteId], null, {
								body: noteBody,
							});
						} else {
							// Create new folder note
							await joplin.data.post(['notes'], null, {
								title: folderNoteTitle,
								body: noteBody,
								parent_id: folder.id,
							});
						}
					}
				} catch (error) {
					console.error('Error in openFolderNote command:', error);
				}
			},
		});

		await joplin.views.toolbarButtons.create(
			'folderNoteButton',
			'openFolderNote',
			ToolbarButtonLocation.EditorToolbar
		);
	},
});