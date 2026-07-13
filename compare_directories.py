#!/usr/bin/env python3
"""
Script to compare two directory structures and generate a markdown report
showing created, changed, and deleted files.
"""

import os
import hashlib
from pathlib import Path
from typing import Dict, Set, Tuple, List


def calculate_file_hash(file_path: Path) -> str:
    """Calculate MD5 hash of a file."""
    hash_md5 = hashlib.md5()
    try:
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return ""


def get_all_files(directory: Path) -> Dict[str, str]:
    """
    Get all files in a directory recursively.
    Returns a dict mapping relative path to file hash.
    """
    files = {}
    if not directory.exists():
        print(f"Warning: Directory {directory} does not exist")
        return files
    
    for file_path in directory.rglob("*"):
        if file_path.is_file():
            relative_path = file_path.relative_to(directory)
            file_hash = calculate_file_hash(file_path)
            files[str(relative_path)] = file_hash
    
    return files


def compare_directories(old_dir: Path, new_dir: Path) -> Tuple[List[str], List[str], List[str]]:
    """
    Compare two directories and return created, changed, and deleted files.
    
    Returns:
        Tuple of (created_files, changed_files, deleted_files)
    """
    print(f"Scanning old directory: {old_dir}")
    old_files = get_all_files(old_dir)
    print(f"Found {len(old_files)} files in old directory")
    
    print(f"Scanning new directory: {new_dir}")
    new_files = get_all_files(new_dir)
    print(f"Found {len(new_files)} files in new directory")
    
    old_paths = set(old_files.keys())
    new_paths = set(new_files.keys())
    
    # Find created, deleted, and potentially changed files
    created = sorted(list(new_paths - old_paths))
    deleted = sorted(list(old_paths - new_paths))
    common = old_paths & new_paths
    
    # Check for changes in common files
    changed = []
    for path in sorted(common):
        if old_files[path] != new_files[path]:
            changed.append(path)
    
    return created, changed, deleted


def generate_markdown_report(created: List[str], changed: List[str], deleted: List[str], output_file: Path):
    """Generate a markdown report of the differences."""
    
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("# Directory Comparison Report\n\n")
        f.write("Comparison between `temp/webview_src_old/src` and `temp/webview_src_new/src`\n\n")
        f.write("---\n\n")
        
        # Summary
        f.write("## Summary\n\n")
        f.write(f"- **Created files**: {len(created)}\n")
        f.write(f"- **Changed files**: {len(changed)}\n")
        f.write(f"- **Deleted files**: {len(deleted)}\n")
        f.write(f"- **Total differences**: {len(created) + len(changed) + len(deleted)}\n\n")
        f.write("---\n\n")
        
        # Created files
        f.write("## Created Files\n\n")
        if created:
            f.write(f"Total: {len(created)} files\n\n")
            for file_path in created:
                f.write(f"- `{file_path}`\n")
        else:
            f.write("*No files were created.*\n")
        f.write("\n---\n\n")
        
        # Changed files
        f.write("## Changed Files\n\n")
        if changed:
            f.write(f"Total: {len(changed)} files\n\n")
            for file_path in changed:
                f.write(f"- `{file_path}`\n")
        else:
            f.write("*No files were changed.*\n")
        f.write("\n---\n\n")
        
        # Deleted files
        f.write("## Deleted Files\n\n")
        if deleted:
            f.write(f"Total: {len(deleted)} files\n\n")
            for file_path in deleted:
                f.write(f"- `{file_path}`\n")
        else:
            f.write("*No files were deleted.*\n")
        f.write("\n")


def main():
    """Main execution function."""
    # Define directories
    workspace_root = Path(__file__).parent
    old_dir = workspace_root / "temp" / "webview_src_old" / "src"
    new_dir = workspace_root / "temp" / "webview_src_new" / "src"
    output_file = workspace_root / "directory_comparison_report.md"
    
    print("=" * 60)
    print("Directory Comparison Tool")
    print("=" * 60)
    print()
    
    # Check if directories exist
    if not old_dir.exists():
        print(f"Error: Old directory does not exist: {old_dir}")
        return
    
    if not new_dir.exists():
        print(f"Error: New directory does not exist: {new_dir}")
        return
    
    # Compare directories
    created, changed, deleted = compare_directories(old_dir, new_dir)
    
    # Generate report
    print()
    print("Generating markdown report...")
    generate_markdown_report(created, changed, deleted, output_file)
    
    print()
    print("=" * 60)
    print(f"Report generated successfully: {output_file}")
    print("=" * 60)
    print()
    print(f"Summary:")
    print(f"  - Created: {len(created)} files")
    print(f"  - Changed: {len(changed)} files")
    print(f"  - Deleted: {len(deleted)} files")
    print()


if __name__ == "__main__":
    main()
