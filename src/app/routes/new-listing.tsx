/**
 * New Listing Page
 * 
 * Primary intake form with AI pipeline progress and multi-platform preview.
 * Three-column layout: Input | Pipeline Progress | Preview
 */

import { useState, useCallback } from 'react';
import {
  Upload,
  Sparkles,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Edit2,
} from 'lucide-react';

// Platform options
const PLATFORMS = [
  { id: 'ebay', name: 'eBay', color: '#E53238' },
  { id: 'shopify', name: 'Shopify', color: '#96BF48' },
  { id: 'etsy', name: 'Etsy', color: '#F1641E' },
  { id: 'facebook', name: 'Facebook', color: '#1877F2' },
  { id: 'pinterest', name: 'Pinterest', color: '#E60023' },
  { id: 'whatnot', name: 'Whatnot', color: '#FF6B35' },
  { id: 'instagram', name: 'Instagram', color: '#E4405F' },
  { id: 'depop', name: 'Depop', color: '#FF2300' },
  { id: 'mercari', name: 'Mercari', color: '#00A0E9' },
  { id: 'poshmark', name: 'Poshmark', color: '#7B2FBE' },
] as const;

// Pipeline phases
const PIPELINE_PHASES = [
  { id: 1, name: 'Analyzing your item', description: 'Detecting category and key attributes' },
  { id: 2, name: 'Extracting details', description: 'Pulling out specs, condition, brand' },
  { id: 3, name: 'Generating content', description: 'Creating titles and descriptions' },
  { id: 4, name: 'Processing images', description: 'Optimizing for each platform' },
  { id: 5, name: 'Preparing for dispatch', description: 'Building platform-specific payloads' },
];

type PhaseStatus = 'pending' | 'running' | 'complete' | 'error';

export default function NewListing() {
   // Form state
  const [inputMode, setInputMode] = useState<'text' | 'structured'>('text');
  const [rawText, setRawText] = useState('');
  const [structuredFields, setStructuredFields] = useState<Record<string, string>>({});
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['ebay']);
  const [images, setImages] = useState<string[]>([]);
  
  // Pipeline state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<number | null>(null);
  const [phaseStatuses, setPhaseStatuses] = useState<Record<number, PhaseStatus>>({});
  const [generatedFields, setGeneratedFields] = useState<Record<string, unknown>>({});
  const [previewTab, setPreviewTab] = useState('ebay');

  // Handle platform toggle
  const togglePlatform = useCallback((platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
  }, []);

  // Handle image upload
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = (e.target as HTMLInputElement).files;
    if (!files) return;

    // In production, this would upload to R2 and get keys
    const newImages = Array.from(files).map((file) => URL.createObjectURL(file));
    setImages((prev) => [...prev, ...newImages].slice(0, 24));
  }, []);

  // Simulate pipeline
  const startPipeline = useCallback(async () => {
    setIsProcessing(true);
    setCurrentPhase(1);
    setPhaseStatuses({ 1: 'running' });
    setGeneratedFields({});

    // Simulate phases
    for (let phase = 1; phase <= 5; phase++) {
      setCurrentPhase(phase);
      setPhaseStatuses((prev) => ({ ...prev, [phase]: 'running' }));

      // Simulate work
      await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000));

      setPhaseStatuses((prev) => ({ ...prev, [phase]: 'complete' }));

      // Add some generated fields based on phase
      if (phase === 1) {
        setGeneratedFields((prev) => ({
          ...prev,
          category: 'Ring',
          categoryCode: 'RNG',
          brand: 'Unknown',
        }));
      } else if (phase === 2) {
        setGeneratedFields((prev) => ({
          ...prev,
          material: '14K Gold',
          size: '7',
          condition: 'Excellent',
        }));
      } else if (phase === 3) {
        setGeneratedFields((prev) => ({
          ...prev,
          title: '14K Gold Diamond Ring Size 7 Excellent Condition',
          description: 'Beautiful 14K gold diamond ring in excellent condition. Size 7. Perfect for engagement or anniversary gift.',
          suggestedPrice: 299.99,
        }));
      }
    }

    setIsProcessing(false);
    setCurrentPhase(null);
  }, []);

  // Can submit?
  const canSubmit = rawText.length >= 10 && selectedPlatforms.length > 0 && images.length > 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-[--text-primary]">Create New Listing</h1>
        <p className="text-sm text-[--text-secondary] mt-1">
          Describe your item and let AI build your listings
        </p>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column 1: Input Panel (30%) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Input mode toggle */}
          <div className="card p-1">
            <div className="flex">
              <button
                onClick={() => setInputMode('text')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  inputMode === 'text'
                    ? 'bg-[--accent-primary] text-white'
                    : 'text-[--text-secondary] hover:text-[--text-primary]'
                }`}
              >
                Free Text
              </button>
              <button
                onClick={() => setInputMode('structured')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  inputMode === 'structured'
                    ? 'bg-[--accent-primary] text-white'
                    : 'text-[--text-secondary] hover:text-[--text-primary]'
                }`}
              >
                Structured Form
              </button>
            </div>
          </div>

          {/* Text input */}
          {inputMode === 'text' ? (
            <div className="card p-4">
              <label className="block text-sm font-medium text-[--text-primary] mb-2">
                Describe your item
              </label>
              <textarea
                 value={rawText}
                 onChange={(e) => setRawText((e.target as HTMLTextAreaElement).value)}
                 placeholder="e.g., 14K gold diamond ring, size 7, 0.5 carat center stone, VS1 clarity, G-H color. Bought from Kay Jewelers, worn only a few times. Original box included."
                 className="input min-h-[150px] text-sm"
               />
              <p className="mt-2 text-xs text-[--text-muted]">
                {rawText.length}/500 characters
              </p>
            </div>
          ) : (
            <StructuredForm fields={structuredFields} onChange={setStructuredFields} />
          )}

          {/* Image upload */}
          <div className="card p-4">
            <label className="block text-sm font-medium text-[--text-primary] mb-2">
              Images ({images.length}/24)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {images.map((img, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg bg-[--bg-elevated] overflow-hidden relative"
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                  >
                    ×
                  </button>
                </div>
              ))}
              {images.length < 24 && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-[--border] flex items-center justify-center cursor-pointer hover:border-[--accent-primary] transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Upload className="h-6 w-6 text-[--text-muted]" />
                </label>
              )}
            </div>
          </div>

          {/* Platform selector */}
          <div className="card p-4">
            <label className="block text-sm font-medium text-[--text-primary] mb-3">
              Target Platforms
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => togglePlatform(platform.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                    selectedPlatforms.includes(platform.id)
                      ? 'border-[--accent-primary] bg-[--accent-primary]/10'
                      : 'border-[--border] hover:border-[--border-hover]'
                  }`}
                >
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: platform.color }}
                  />
                  <span className="text-sm text-[--text-primary]">{platform.name}</span>
                  {selectedPlatforms.includes(platform.id) && (
                    <CheckCircle2 className="h-4 w-4 text-[--accent-primary] ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={startPipeline}
            disabled={!canSubmit || isProcessing}
            className="btn-primary w-full py-3"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generate Listing
              </>
            )}
          </button>
        </div>

        {/* Column 2: Pipeline Progress (40%) */}
        <div className="lg:col-span-4">
          <div className="card">
            <div className="p-4 border-b border-[--border]">
              <h2 className="font-medium text-[--text-primary]">AI Pipeline</h2>
            </div>
            <div className="p-4 space-y-3">
              {PIPELINE_PHASES.map((phase) => {
                const status = phaseStatuses[phase.id] || 'pending';
                const isActive = currentPhase === phase.id;

                return (
                  <div
                    key={phase.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      isActive
                        ? 'border-[--accent-primary] bg-[--accent-primary]/5'
                        : status === 'complete'
                        ? 'border-[--accent-success]/50 bg-[--accent-success]/5'
                        : status === 'error'
                        ? 'border-[--accent-error]/50 bg-[--accent-error]/5'
                        : 'border-[--border]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {status === 'complete' ? (
                          <CheckCircle2 className="h-5 w-5 text-[--accent-success]" />
                        ) : status === 'error' ? (
                          <AlertCircle className="h-5 w-5 text-[--accent-error]" />
                        ) : isActive ? (
                          <Loader2 className="h-5 w-5 text-[--accent-primary] animate-spin" />
                        ) : (
                          <Circle className="h-5 w-5 text-[--text-muted]" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          isActive ? 'text-[--accent-primary]' :
                          status === 'complete' ? 'text-[--accent-success]' :
                          status === 'error' ? 'text-[--accent-error]' :
                          'text-[--text-primary]'
                        }`}>
                          {phase.name}
                        </p>
                        <p className="text-xs text-[--text-muted] mt-0.5">
                          {status === 'running' ? 'Processing...' : phase.description}
                        </p>

                        {/* Show generated fields for completed phases */}
                        {status === 'complete' && phase.id === 2 && (generatedFields['material'] as unknown) ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {Object.entries(generatedFields).slice(0, 4).map(([key, value]) => (
                                  <span key={key} className="badge bg-[--bg-elevated] text-[--text-secondary]">
                                    {String((value as unknown) || '') as any}
                                  </span>
                                ))}
                          </div>
                        ) : null as any}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Generated fields preview */}
          {Object.keys(generatedFields).length > 0 && (
            <div className="card mt-4 p-4">
              <h3 className="text-sm font-medium text-[--text-primary] mb-3">Extracted Details</h3>
              <div className="space-y-2">
                {Object.entries(generatedFields).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between py-1">
                    <span className="text-sm text-[--text-muted] capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="text-sm text-[--text-primary]">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Column 3: Preview Panel (30%) */}
        <div className="lg:col-span-4">
          <div className="card">
            {/* Platform tabs */}
            <div className="flex border-b border-[--border]">
              {selectedPlatforms.map((platformId) => {
                const platform = PLATFORMS.find((p) => p.id === platformId);
                if (!platform) return null;
                return (
                  <button
                    key={platformId}
                    onClick={() => setPreviewTab(platformId)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      previewTab === platformId
                        ? 'border-[--accent-primary] text-[--accent-primary]'
                        : 'border-transparent text-[--text-secondary] hover:text-[--text-primary]'
                    }`}
                    style={previewTab === platformId ? { borderColor: platform.color, color: platform.color } : undefined}
                  >
                    {platform.name}
                  </button>
                );
              })}
            </div>

            {/* Preview content */}
            <div className="p-4">
              {(generatedFields['title'] as unknown) ? (
                  <div className="space-y-4">
                    {/* Title */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-[--text-muted]">Title</label>
                        <span className="text-xs text-[--text-muted]">
                          {(String((generatedFields['title'] as unknown) || '').length as any)}/80
                        </span>
                      </div>
                      <p className="text-sm text-[--text-primary]">{String((generatedFields['title'] as unknown) || '') as any}</p>
                    <button className="mt-1 text-xs text-[--accent-primary] hover:underline flex items-center gap-1">
                      <Edit2 className="h-3 w-3" /> Edit
                    </button>
                  </div>

                  {/* Price */}
                  {(generatedFields['suggestedPrice'] as unknown) && (
                    <div>
                      <label className="text-xs text-[--text-muted] block mb-1">Suggested Price</label>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-[--text-primary]">
                          ${Number(generatedFields['suggestedPrice'] || 0).toFixed(2)}
                        </span>
                        <span className="badge bg-[--accent-warning]/20 text-[--accent-warning] text-xs">
                          AI Suggested
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {generatedFields['description'] && (
                    <div>
                      <label className="text-xs text-[--text-muted] block mb-1">Description</label>
                      <p className="text-sm text-[--text-secondary] line-clamp-4">
                        {String(generatedFields['description'] || '')}
                      </p>
                    </div>
                  )}

                  {/* Images preview */}
                  {images.length > 0 && (
                    <div>
                      <label className="text-xs text-[--text-muted] block mb-2">Images</label>
                      <div className="grid grid-cols-3 gap-2">
                        {images.slice(0, 6).map((img, i) => (
                          <div key={i} className="aspect-square rounded-lg overflow-hidden bg-[--bg-elevated]">
                            <img src={img} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="h-12 w-12 rounded-full bg-[--bg-elevated] flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="h-6 w-6 text-[--text-muted]" />
                  </div>
                  <p className="text-sm text-[--text-muted]">
                    Enter item details and click Generate to see preview
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Structured form component
interface StructuredFormProps {
  fields: Record<string, string>;
  onChange: (fields: Record<string, string>) => void;
}

function StructuredForm({ fields, onChange }: StructuredFormProps) {
  const handleChange = (key: string, value: string) => {
    onChange({ ...fields, [key]: value });
  };

  return (
    <div className="card p-4 space-y-3">
      <div>
        <label className="block text-xs text-[--text-muted] mb-1">Title</label>
        <input
          type="text"
          value={fields['title'] || ''}
          onChange={(e) => handleChange('title', (e.target as HTMLInputElement).value)}
          placeholder="Item title"
          className="input text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[--text-muted] mb-1">Category</label>
          <select
            value={fields['category'] || ''}
            onChange={(e) => handleChange('category', (e.target as HTMLSelectElement).value)}
            className="input text-sm"
          >
            <option value="">Select...</option>
            <option value="RNG">Ring</option>
            <option value="NKL">Necklace</option>
            <option value="BRD">Bracelet</option>
            <option value="ERG">Earring</option>
            <option value="WTC">Watch</option>
            <option value="PND">Pendant</option>
            <option value="SET">Set</option>
            <option value="OTH">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-[--text-muted] mb-1">Condition</label>
          <select
            value={fields['condition'] || ''}
            onChange={(e) => handleChange('condition', (e.target as HTMLSelectElement).value)}
            className="input text-sm"
          >
            <option value="">Select...</option>
            <option value="new">New</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[--text-muted] mb-1">Brand</label>
          <input
            type="text"
            value={fields['brand'] || ''}
            onChange={(e) => handleChange('brand', (e.target as HTMLInputElement).value)}
            placeholder="Brand name"
            className="input text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-[--text-muted] mb-1">Size</label>
          <input
            type="text"
            value={fields['size'] || ''}
            onChange={(e) => handleChange('size', (e.target as HTMLInputElement).value)}
            placeholder="Size"
            className="input text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-[--text-muted] mb-1">Material</label>
        <input
          type="text"
          value={fields['material'] || ''}
          onChange={(e) => handleChange('material', (e.target as HTMLInputElement).value)}
          placeholder="e.g., 14K Gold, Sterling Silver"
          className="input text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-[--text-muted] mb-1">Notes</label>
        <textarea
          value={fields['notes'] || ''}
          onChange={(e) => handleChange('notes', (e.target as HTMLTextAreaElement).value)}
          placeholder="Additional details..."
          className="input text-sm min-h-[60px]"
        />
      </div>
    </div>
  );
}
