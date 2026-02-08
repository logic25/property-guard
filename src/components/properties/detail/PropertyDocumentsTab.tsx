import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  FileText, 
  Upload, 
  Download,
  Trash2,
  Eye,
  Loader2,
  File,
  Image,
  FileCode,
  Pencil,
  LayoutGrid,
  List,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface Document {
  id: string;
  document_type: string;
  document_name: string;
  file_url: string;
  file_type: string | null;
  file_size_bytes: number | null;
  uploaded_at: string;
  metadata: Record<string, unknown> | null;
}

interface PropertyDocumentsTabProps {
  propertyId: string;
  documents: Document[];
  onRefresh: () => void;
}

const DOCUMENT_TYPES = [
  { value: 'certificate_of_occupancy', label: 'Certificate of Occupancy' },
  { value: 'survey', label: 'Survey' },
  { value: 'lease', label: 'Lease' },
  { value: 'floor_plan', label: 'Floor Plan' },
  { value: 'site_plan', label: 'Site Plan' },
  { value: 'permit', label: 'Permit' },
  { value: 'inspection_report', label: 'Inspection Report' },
  { value: 'photo', label: 'Photo' },
  { value: 'other', label: 'Other' },
];

export const PropertyDocumentsTab = ({ propertyId, documents, onRefresh }: PropertyDocumentsTabProps) => {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('other');
  const [documentName, setDocumentName] = useState('');
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!documentName) {
        setDocumentName(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setIsUploading(true);

    try {
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
      const fileName = `${propertyId}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('property-documents')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('property-documents')
        .getPublicUrl(fileName);

      // Create document record
      const { data: insertedDoc, error: insertError } = await supabase
        .from('property_documents')
        .insert({
          property_id: propertyId,
          document_type: documentType,
          document_name: documentName || selectedFile.name,
          file_url: urlData.publicUrl,
          file_type: fileExt,
          file_size_bytes: selectedFile.size,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success('Document uploaded successfully');
      setIsDialogOpen(false);
      setSelectedFile(null);
      setDocumentName('');
      setDocumentType('other');
      onRefresh();

      // If it's a PDF, automatically extract text for AI
      if (fileExt === 'pdf' && insertedDoc) {
        toast.info('Extracting text for AI analysis...');
        try {
          const { data, error } = await supabase.functions.invoke('extract-document-text', {
            body: { documentId: insertedDoc.id, fileUrl: urlData.publicUrl }
          });
          if (error) throw error;
          if (data?.success) {
            toast.success(`Extracted ${data.charactersExtracted.toLocaleString()} characters for AI`);
            onRefresh();
          }
        } catch (extractError) {
          console.error('Text extraction error:', extractError);
          toast.error('Could not extract text for AI analysis');
        }
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleEdit = (doc: Document) => {
    setEditingDoc(doc);
    setEditName(doc.document_name);
    setEditType(doc.document_type);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingDoc) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('property_documents')
        .update({
          document_name: editName,
          document_type: editType,
        })
        .eq('id', editingDoc.id);

      if (error) throw error;

      toast.success('Document updated');
      setIsEditDialogOpen(false);
      setEditingDoc(null);
      onRefresh();
    } catch (error) {
      console.error('Error updating document:', error);
      toast.error('Failed to update document');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      // Delete from storage (extract path from URL)
      const urlParts = doc.file_url.split('/property-documents/');
      if (urlParts[1]) {
        await supabase.storage
          .from('property-documents')
          .remove([urlParts[1]]);
      }

      // Delete record
      const { error } = await supabase
        .from('property_documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      toast.success('Document deleted');
      onRefresh();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <File className="w-4 h-4" />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileType.toLowerCase())) {
      return <Image className="w-4 h-4" />;
    }
    if (['pdf'].includes(fileType.toLowerCase())) {
      return <FileText className="w-4 h-4" />;
    }
    if (['dwg', 'dxf'].includes(fileType.toLowerCase())) {
      return <FileCode className="w-4 h-4" />;
    }
    return <File className="w-4 h-4" />;
  };

  const getTypeLabel = (type: string) => {
    return DOCUMENT_TYPES.find(t => t.value === type)?.label || type;
  };

  // Group documents by type for grid view
  const documentsByType = documents.reduce((acc, doc) => {
    const type = doc.document_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  return (
    <div className="space-y-6">
      {/* Header with Upload and View Toggle */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero">
              <Upload className="w-4 h-4" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Document Type</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Document Name</Label>
                <Input
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="Enter document name"
                />
              </div>

              <div className="space-y-2">
                <Label>File</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.dwg,.dxf,.doc,.docx"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2">
                      {getFileIcon(selectedFile.name.split('.').pop() || null)}
                      <div className="text-left">
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(selectedFile.size)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Click to select a file
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="hero" 
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Upload
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Documents Display */}
      {documents.length > 0 ? (
        viewMode === 'table' ? (
          /* Table View */
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                        {getFileIcon(doc.file_type)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{doc.document_name}</TableCell>
                    <TableCell>
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-secondary text-muted-foreground">
                        {getTypeLabel(doc.document_type)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatFileSize(doc.file_size_bytes)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => window.open(doc.file_url, '_blank')}>
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={doc.file_url} download>
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(doc)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => handleDelete(doc)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          /* Grid View */
          <div className="space-y-6">
            {Object.entries(documentsByType).map(([type, docs]) => (
              <div key={type}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  {getTypeLabel(type)}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          {getFileIcon(doc.file_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-foreground truncate">
                            {doc.document_name}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(doc.file_size_bytes)} • {new Date(doc.uploaded_at).toLocaleDateString()}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => window.open(doc.file_url, '_blank')}>
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={doc.file_url} download>
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(doc)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => handleDelete(doc)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold text-foreground mb-2">No documents yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Upload certificates, surveys, leases, and other property documents.
          </p>
          <Button variant="hero" onClick={() => setIsDialogOpen(true)}>
            <Upload className="w-4 h-4" />
            Upload Document
          </Button>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) setEditingDoc(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Document Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter document name"
              />
            </div>

            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="hero" 
                onClick={handleSaveEdit}
                disabled={isSaving || !editName.trim()}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};