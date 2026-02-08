import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple PDF text extractor - extracts text streams from PDF without heavy libraries
async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  const decoder = new TextDecoder('latin1');
  const content = decoder.decode(pdfBytes);
  
  const textParts: string[] = [];
  
  // Method 1: Extract text between BT (begin text) and ET (end text) markers
  const btEtPattern = /BT\s*([\s\S]*?)\s*ET/g;
  let match;
  
  while ((match = btEtPattern.exec(content)) !== null) {
    const textBlock = match[1];
    
    // Extract strings in parentheses (literal strings)
    const literalPattern = /\(([^)]*)\)/g;
    let literalMatch;
    while ((literalMatch = literalPattern.exec(textBlock)) !== null) {
      let text = literalMatch[1];
      // Unescape common PDF escape sequences
      text = text.replace(/\\n/g, '\n')
                 .replace(/\\r/g, '\r')
                 .replace(/\\t/g, '\t')
                 .replace(/\\\(/g, '(')
                 .replace(/\\\)/g, ')')
                 .replace(/\\\\/g, '\\');
      if (text.trim()) {
        textParts.push(text);
      }
    }
    
    // Extract hex strings in angle brackets
    const hexPattern = /<([0-9A-Fa-f]+)>/g;
    let hexMatch;
    while ((hexMatch = hexPattern.exec(textBlock)) !== null) {
      const hex = hexMatch[1];
      let text = '';
      for (let i = 0; i < hex.length; i += 2) {
        const charCode = parseInt(hex.substr(i, 2), 16);
        if (charCode >= 32 && charCode < 127) {
          text += String.fromCharCode(charCode);
        }
      }
      if (text.trim()) {
        textParts.push(text);
      }
    }
  }
  
  // Method 2: Also look for stream content that might contain text
  const streamPattern = /stream\s*([\s\S]*?)\s*endstream/g;
  while ((match = streamPattern.exec(content)) !== null) {
    const streamContent = match[1];
    // Only process if it looks like it contains text operators
    if (streamContent.includes('Tj') || streamContent.includes('TJ')) {
      const tjPattern = /\(([^)]+)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjPattern.exec(streamContent)) !== null) {
        const text = tjMatch[1].replace(/\\./g, '');
        if (text.trim() && text.length > 1) {
          textParts.push(text);
        }
      }
    }
  }
  
  // Join and clean up the extracted text
  let extractedText = textParts.join(' ');
  
  // Clean up multiple spaces and normalize
  extractedText = extractedText
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
  
  return extractedText;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { documentId, fileUrl } = await req.json();

    if (!documentId || !fileUrl) {
      return new Response(JSON.stringify({ error: "documentId and fileUrl are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Extracting text from document:", documentId);

    // Extract storage path from URL
    const urlParts = fileUrl.split('/property-documents/');
    if (urlParts.length !== 2) {
      throw new Error("Invalid file URL format");
    }
    const storagePath = urlParts[1];

    // Download the PDF
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('property-documents')
      .download(storagePath);

    if (downloadError) {
      console.error("Storage download error:", downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    if (!fileData) {
      throw new Error("No file data received");
    }

    const fileBuffer = await fileData.arrayBuffer();
    const pdfBytes = new Uint8Array(fileBuffer);
    console.log("Downloaded PDF:", pdfBytes.length, "bytes");

    // Extract text using our lightweight parser
    let extractedText = await extractTextFromPdf(pdfBytes);
    console.log("Extracted text length:", extractedText.length);

    // If basic extraction got little text, try AI as fallback (for scanned/image PDFs)
    if (extractedText.length < 500) {
      console.log("Low text content, trying AI extraction for scanned PDF...");
      
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        // Convert to base64 in chunks
        const chunkSize = 8192;
        let binaryString = '';
        for (let i = 0; i < pdfBytes.length; i += chunkSize) {
          const chunk = pdfBytes.subarray(i, Math.min(i + chunkSize, pdfBytes.length));
          binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64File = btoa(binaryString);

        // Only send first ~2MB to AI to stay within timeout
        const maxBase64Length = 2 * 1024 * 1024;
        const truncatedBase64 = base64File.length > maxBase64Length 
          ? base64File.substring(0, maxBase64Length) 
          : base64File;

        const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Extract all text from this PDF document. Output only the text content.",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:application/pdf;base64,${truncatedBase64}`,
                    },
                  },
                ],
              },
            ],
          }),
        });

        if (extractResponse.ok) {
          const result = await extractResponse.json();
          const aiText = result.choices?.[0]?.message?.content || "";
          if (aiText.length > extractedText.length) {
            extractedText = aiText;
            console.log("AI extraction got more text:", extractedText.length, "chars");
          }
        }
      }
    }

    if (!extractedText || extractedText.length < 10) {
      throw new Error("Could not extract text from document");
    }

    // Save extracted text
    const { error: updateError } = await supabaseClient
      .from('property_documents')
      .update({ extracted_text: extractedText })
      .eq('id', documentId);

    if (updateError) {
      console.error("Error saving extracted text:", updateError);
      throw updateError;
    }

    console.log("Successfully extracted", extractedText.length, "characters");

    return new Response(
      JSON.stringify({ 
        success: true, 
        charactersExtracted: extractedText.length,
        preview: extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : '')
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Document extraction error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
