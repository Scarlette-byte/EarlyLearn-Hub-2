import { IconClose } from '../Icons.jsx';

export default function TeacherUploadModal({
  isOpen,
  onClose,
  activeAssignmentId,
  activeAssignmentDeadline,
  uploadCurriculumLevel,
  uploadQuarter,
  uploadWeek,
  uploadTitle,
  setUploadTitle,
  uploadDescription,
  setUploadDescription,
  uploadType,
  setUploadType,
  uploadUrl,
  setUploadUrl,
  uploadFileName,
  uploadFileSize,
  uploadFileType,
  uploadFilePreview,
  isDraggingFile,
  setIsDraggingFile,
  fileInputRef,
  uploadMsg,
  handleFileSelected,
  handleRemoveSelectedFile,
  handleModalLevelChange,
  handleModalQuarterChange,
  handleModalWeekChange,
  handleSaveMaterial,
  availableWeeksForUploadModal,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-5 space-y-4 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 m-0">
              Upload Curriculum Learning Material
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Directly assigned to official DepEd ECCD weekly lessons.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveMaterial} className="space-y-3.5 text-xs">
          {/* Assigned Topic Fulfillment Banner */}
          {activeAssignmentId && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between">
              <div>
                <div className="font-bold flex items-center gap-1.5">
                  <span>🎯 Fulfilling Admin-Assigned Topic</span>
                </div>
                <div className="text-[11px] text-amber-800 mt-0.5">
                  {activeAssignmentDeadline ? `Official Deadline: ${activeAssignmentDeadline}` : 'No deadline set'} • Upon upload, this assignment will be marked as Completed.
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-amber-200/70 text-amber-950">
                Assigned by MSWDO
              </span>
            </div>
          )}

          {/* PROMINENT CHOOSE FILE & DRAG FILE DROPZONE */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <span>📎</span>
                <span>Upload File (Choose File &amp; Drag File)</span>
              </label>
              {uploadFileName && (
                <button
                  type="button"
                  onClick={handleRemoveSelectedFile}
                  className="text-[11px] text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                >
                  ✕ Remove File
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.mp4,.zip"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelected(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            {!uploadFileName ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingFile(true);
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingFile(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingFile(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingFile(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelected(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                  isDraggingFile
                    ? 'border-accent bg-amber-50/70 scale-[1.01]'
                    : 'border-slate-300 bg-slate-50/80 hover:bg-slate-100 hover:border-slate-400'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-2xl text-accent">
                  {isDraggingFile ? '📥' : '☁️'}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-xs sm:text-sm m-0">
                    Drag &amp; drop file here, or{' '}
                    <span className="text-accent underline font-extrabold">choose file</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 mb-0">
                    PDF, Word, Excel, PowerPoint, Images (PNG/JPG), MP4 Video, Worksheets
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="mt-1 px-4 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-slate-400 text-slate-800 font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>📁</span>
                  <span>Choose File</span>
                </button>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {uploadFilePreview && ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF'].includes(uploadFileType) ? (
                    <img
                      src={uploadFilePreview}
                      alt="Preview"
                      className="w-12 h-12 object-cover rounded-lg border border-emerald-200 shadow-xs shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-emerald-700 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                      {uploadFileType || 'FILE'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-xs truncate max-w-xs">
                      {uploadFileName}
                    </div>
                    <div className="text-[11px] text-emerald-800 font-medium flex items-center gap-2 mt-0.5">
                      <span>{uploadFileSize}</span>
                      <span>•</span>
                      <span className="font-bold text-emerald-700">✓ Ready to upload</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveSelectedFile}
                    className="p-1 rounded-md hover:bg-rose-100 text-rose-600 cursor-pointer"
                    title="Remove file"
                  >
                    <IconClose className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Step 1: Curriculum Level */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              1. Curriculum Level
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleModalLevelChange('PRE-K1')}
                className={`py-2 px-3 rounded-lg font-semibold border text-left cursor-pointer transition-colors ${
                  uploadCurriculumLevel === 'PRE-K1'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="font-bold">PRE-K 1</div>
                <div className="text-[10.5px] opacity-80">3.11 years old (3 – 3.11)</div>
              </button>

              <button
                type="button"
                onClick={() => handleModalLevelChange('PRE-K2')}
                className={`py-2 px-3 rounded-lg font-semibold border text-left cursor-pointer transition-colors ${
                  uploadCurriculumLevel === 'PRE-K2'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="font-bold">PRE-K 2</div>
                <div className="text-[10.5px] opacity-80">4.11 years old (4 – 4.11)</div>
              </button>
            </div>
          </div>

          {/* Step 2: Quarter & Week */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                2. Quarter
              </label>
              <select
                value={uploadQuarter}
                onChange={(e) => handleModalQuarterChange(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 outline-none"
              >
                <option value={1}>Quarter 1</option>
                <option value={2}>Quarter 2</option>
                <option value={3}>Quarter 3</option>
                <option value={4}>Quarter 4</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                3. ECCD Week &amp; Theme
              </label>
              <select
                value={uploadWeek}
                onChange={(e) => handleModalWeekChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 outline-none"
              >
                {availableWeeksForUploadModal?.weeks?.map((w) => (
                  <option key={w.week} value={w.week}>
                    {w.week}: {w.subTheme}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 3: Material Type */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              4. Post Format / Material Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { type: 'activity', label: '✏️ Activity', desc: 'Worksheet / task' },
                { type: 'file', label: '📁 File / PDF', desc: 'Document / guide' },
                { type: 'video', label: '🎬 Video', desc: 'Video demonstration' },
                { type: 'image', label: '🖼️ Picture', desc: 'Visual card / craft' },
              ].map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => setUploadType(t.type)}
                  className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                    uploadType === t.type
                      ? 'border-slate-900 bg-slate-50 font-bold text-slate-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div>{t.label}</div>
                  <div className="text-[10px] text-slate-400">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 4: Material Title */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              5. Material Title
            </label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="e.g. [Pre-K 1 Q1 W1] I Have A Name - Fun Writing Practice"
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 outline-none"
            />
          </div>

          {/* Step 5: Content URL */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              6. Resource / Video / Worksheet Link <span className="text-slate-400 font-normal">(optional if file is attached)</span>
            </label>
            <input
              type="url"
              value={uploadUrl}
              onChange={(e) => setUploadUrl(e.target.value)}
              placeholder="https://youtube.com/... or cloud link"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 outline-none"
            />
          </div>

          {/* Step 6: Instructions / Question */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              7. Activity Instructions or Question for Parent &amp; Learner
            </label>
            <textarea
              rows={3}
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              placeholder="e.g. Help your child trace their first name with crayons. Write what letters they recognized!"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 outline-none resize-none"
            />
          </div>

          {uploadMsg.text && (
            <div className={`p-2.5 rounded-lg text-xs font-semibold ${
              uploadMsg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'
            }`}>
              {uploadMsg.text}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-xs cursor-pointer"
            >
              Upload Material
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
