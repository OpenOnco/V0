#!/usr/bin/env python3
"""Backfill sample tube fields from Lu Zhang's Streck review."""
import re

EDITS = {
    # test_name: (tube_type_to_add, tube_count_to_add, citations_to_add)
    # None means "don't add this field"
    "clonoSEQ": (None, 2, None),
    "Resolution ctDx FIRST": (None, 1, "https://www.accessdata.fda.gov/cdrh_docs/pdf21/P210040C.pdf"),
    "Northstar Select": (None, 2, "https://cdn.prod.website-files.com/676903c0e34284138d6e0066/"),
    "Avantect Pancreatic Cancer Test": ("Streck Cell-Free DNA BCT", 1, "https://www.sciencedirect.com/science/article/pii/S1525157824002880"),
    "FirstLook Lung": ("Streck Cell-Free DNA BCT", 1, None),
    "Freenome CRC Blood Test": ("Streck Cell-Free DNA BCT", 5, None),
    "Guardant360 CDx": (None, None, "https://www.accessdata.fda.gov/cdrh_docs/pdf20/P200010S008C.pdf"),
    "Guardant360 Liquid": ("Streck Cell-Free DNA BCT", None, "https://guardanthealth.com/wp-content/uploads/REC-REG-000010"),
    "Hedera Profiling 2 ctDNA Test Panel": ("Streck Cell-Free DNA BCT", 1, "https://www.dlongwood.com/wp-content/uploads/2023/10/Hedera-"),
    "MRDVision": ("Streck Cell-Free DNA BCT", 2, "https://inocras.com/mrdvision/"),
    "CancerVista": (None, None, "https://liqomics.com/en/downloads/submission-information-en.pdf"),
    "LymphoVista": (None, None, "https://liqomics.com/en/downloads/submission-information-en.pdf"),
    "LiquidHALLMARK": (None, 2, "https://valleyhealth.testcatalog.org/show/LUCHM"),
    "Foresight CLARITY Lymphoma": ("Streck Cell-Free DNA BCT", 2, "https://pmc.ncbi.nlm.nih.gov/articles/PMC12068320/"),
    "Latitude": ("Streck Cell-Free DNA BCT", 1, "https://www.natera.com/oncology/latitude-tissue-free-mrd/"),
    "Signatera Genome": ("Streck Cell-Free DNA BCT", 2, "https://www.natera.com/oncology/signatera-advanced-cancer-de"),
    "RaDaR ST": ("Streck Cell-Free DNA BCT", 1, "https://cms.neogenomics.com/sites/default/files/literature/S"),
    "EPISEEK": (None, None, "https://precision-epigenomics.com/wp-content/uploads/2024/04/"),
    "Pathlight": ("Streck Cell-Free DNA BCT", 1, "https://pmc.ncbi.nlm.nih.gov/articles/PMC11994999/"),
    "OncoBEAM RAS CRC Kit": ("Streck Cell-Free DNA BCT", 1, "https://pmc.ncbi.nlm.nih.gov/articles/PMC6734650/"),
    "Tempus xF": (None, 2, "https://mlabs.umich.edu/tests/tempus-genomic-sequencing"),
    "Tempus xF+": (None, 1, "https://www.tempus.com/wp-content/uploads/2022/10/Tempus-LS_"),
    "PGDx elio plasma focus Dx": ("Streck Cell-Free DNA BCT", 1, "https://www.accessdata.fda.gov/cdrh_docs/reviews/DEN230046.pdf"),
    "Signal-C": ("Streck Cell-Free DNA BCT", None, "https://clinicaltrials.gov/study/NCT06059963"),
}

# FoundationOne Tracker appears twice (MRD + TRM)
FT_EDIT = ("Streck Cell-Free DNA BCT", 2, "https://assets.ctfassets.net/w98cd481qyp0/1iqyMQwcJ0jGCYhUxc")

with open('src/data.js', 'r') as f:
    lines = f.readlines()

edit_count = 0

def find_test_lines(test_name):
    """Find all line indices where "name": "test_name" appears."""
    results = []
    for i, line in enumerate(lines):
        if f'"name": "{test_name}"' in line:
            results.append(i)
    return results


def get_block_range(name_line):
    """Get the start of the test object (find the opening {) and surrounding sample fields."""
    # Search backwards for the opening { of this test object
    obj_start = name_line
    brace_depth = 0
    for i in range(name_line, max(0, name_line - 20), -1):
        if '{' in lines[i]:
            obj_start = i
            break
    return obj_start

def has_field_in_block(name_line, field_name, look_back=10, look_forward=100):
    """Check if a field exists in the test block."""
    start = max(0, name_line - look_back)
    end = min(len(lines), name_line + look_forward)
    block = ''.join(lines[start:end])
    return f'"{field_name}"' in block

def find_insert_point(name_line):
    """Find the best line to insert sample fields.
    Priority: after sampleCategory/sampleVolumeMl/sampleTubeType/sampleCollectionNotes, 
    or before name line."""
    # Look backwards from name line for sample fields
    best = name_line  # default: insert before name
    for i in range(name_line - 1, max(0, name_line - 10), -1):
        line = lines[i]
        if any(f'"{f}"' in line for f in ['sampleCitations', 'sampleCollectionNotes', 'sampleTubeCount', 'sampleTubeType', 'sampleVolumeMin', 'sampleVolumeMl', 'sampleCategory']):
            best = i + 1
            break
    return best

def apply_edit(name_line, tube_type, tube_count, citations):
    global edit_count, lines
    
    # Determine indentation from the name line
    indent = re.match(r'^(\s*)', lines[name_line]).group(1)
    
    inserts = []
    insert_at = find_insert_point(name_line)
    
    if tube_type and not has_field_in_block(name_line, 'sampleTubeType'):
        inserts.append(f'{indent}"sampleTubeType": "{tube_type}",\n')
    
    if tube_count is not None and not has_field_in_block(name_line, 'sampleTubeCount'):
        inserts.append(f'{indent}"sampleTubeCount": {tube_count},\n')
    
    if citations and not has_field_in_block(name_line, 'sampleCitations'):
        inserts.append(f'{indent}"sampleCitations": "{citations}",\n')
    
    if inserts:
        for j, ins in enumerate(inserts):
            lines.insert(insert_at + j, ins)
            edit_count += 1
        return len(inserts)
    return 0

# Process all edits
total_fields_added = 0

# Regular tests (single occurrence)
for test_name, (tube_type, tube_count, citations) in EDITS.items():
    matches = find_test_lines(test_name)
    if not matches:
        print(f"  WARNING: '{test_name}' not found!")
        continue
    
    # Process in reverse order so line numbers stay valid
    for name_line in reversed(matches):
        added = apply_edit(name_line, tube_type, tube_count, citations)
        if added:
            print(f"  ✅ {test_name} (line ~{name_line}): +{added} fields")
            total_fields_added += added

# FoundationOne Tracker (appears twice)
ft_matches = find_test_lines("FoundationOne Tracker")
tube_type, tube_count, citations = FT_EDIT
for name_line in reversed(ft_matches):
    added = apply_edit(name_line, tube_type, tube_count, citations)
    if added:
        print(f"  ✅ FoundationOne Tracker (line ~{name_line}): +{added} fields")
        total_fields_added += added

print(f"\n=== TOTAL: {total_fields_added} fields added across {edit_count} insertions ===")

with open('src/data.js', 'w') as f:
    f.writelines(lines)

print("data.js updated successfully.")
