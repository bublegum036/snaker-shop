"""Inspect exported pages, including layout differences in Chrome PDF media."""
import json
from pathlib import Path
import fitz

root=Path(__file__).resolve().parent.parent
reports=[]
for filename,count,first in [('sneaker-backend-chapters-1-18.pdf',192,1),('sneaker-backend-chapters-17-18.pdf',14,179)]:
    doc=fitz.open(root/filename)
    errors=[]
    if len(doc)!=count:
        errors.append({'kind':'page_count','actual':len(doc),'expected':count})
    for index,page in enumerate(doc):
        words=page.get_text('words')
        if not words:
            errors.append({'page':index+first,'kind':'empty'})
        for x0,y0,x1,y1,word,*_ in words:
            if x0<24 or x1>page.rect.width-24 or y0<20 or y1>page.rect.height-6:
                errors.append({'page':index+first,'kind':'text_outside_margin','word':word})
    reports.append({'file':filename,'pages':len(doc),'errors':errors})
(root/'sneaker-backend-checks/pdf-results.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(reports,ensure_ascii=False,indent=2))
assert not any(item['errors'] for item in reports)
