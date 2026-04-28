-- F12-K37: image node w whiteboard. Klient: 'dodaj opcje dodawania
-- zdjęc do whiteboard'. Storage path zapisany w ProcessNode.dataJson
-- jako { imagePath: string }, fizyczny plik w Supabase bucket
-- 'attachments' pod kluczem 'w/<wid>/canvas/<canvasId>/<filename>'.

ALTER TYPE "NodeShape" ADD VALUE 'IMAGE';
