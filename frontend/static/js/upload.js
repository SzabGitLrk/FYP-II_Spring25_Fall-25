// Enhanced upload.js with drag & drop and better feedback
document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("uploadForm");
    const dropArea = document.getElementById("dropArea");
    const fileInput = document.getElementById("reportFile");
    const fileInfo = document.getElementById("selectedFile");
    const statusDiv = document.getElementById("uploadStatus");
    const uploadBtn = document.getElementById("uploadBtn");
    const btnText = document.getElementById("btnText");
    const spinner = document.getElementById("spinner");
    const processingModal = new bootstrap.Modal(document.getElementById('processingModal'));
    
    // Store results container if exists
    const resultsSection = document.getElementById("resultsSection");
    const resultsContent = document.getElementById("resultsContent");

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropArea.classList.add('drag-over');
    }

    function unhighlight() {
        dropArea.classList.remove('drag-over');
    }

    // Handle dropped files
    dropArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            fileInput.files = files;
            displayFileInfo(files[0]);
        }
    }

    // Handle file selection via browse button
    fileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            displayFileInfo(this.files[0]);
        }
    });

    // Display file information
    function displayFileInfo(file) {
        if (!isValidFile(file)) {
            showStatus("Please select a valid file (PDF, JPG, JPEG, PNG)", "error");
            return;
        }
        
        const fileSize = formatFileSize(file.size);
        fileInfo.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-file me-2"></i>
                <strong>Selected:</strong> ${file.name}<br>
                <small>Size: ${fileSize} | Type: ${getFileType(file.name)}</small>
            </div>
        `;
        
        statusDiv.innerHTML = "";
        statusDiv.className = "";
    }

    // Check if file is valid
    function isValidFile(file) {
        const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
        const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        return allowedExtensions.includes(extension);
    }

    // Format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Get file type
    function getFileType(filename) {
        const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        switch(extension) {
            case '.pdf': return 'PDF Document';
            case '.jpg': 
            case '.jpeg': return 'JPEG Image';
            case '.png': return 'PNG Image';
            default: return 'Unknown';
        }
    }

    // Show status message
    function showStatus(message, type) {
        statusDiv.innerHTML = '';
        
        if (type === 'success') {
            statusDiv.innerHTML = `
                <div class="alert alert-success alert-dismissible fade show" role="alert">
                    <i class="fas fa-check-circle me-2"></i>
                    ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
        } else if (type === 'error') {
            statusDiv.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
        } else if (type === 'warning') {
            statusDiv.innerHTML = `
                <div class="alert alert-warning alert-dismissible fade show" role="alert">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
        }
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                const alert = statusDiv.querySelector('.alert');
                if (alert) {
                    const bsAlert = new bootstrap.Alert(alert);
                    bsAlert.close();
                }
            }, 5000);
        }
    }

    // Form submission - UPDATED VERSION
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const file = fileInput.files[0];

        if (!file) {
            showStatus("Please select a file!", "error");
            return;
        }

        if (!isValidFile(file)) {
            showStatus("Please select a valid file (PDF, JPG, JPEG, PNG)", "error");
            return;
        }

        if (file.size > 16 * 1024 * 1024) { // 16MB limit
            showStatus("File size too large. Maximum size is 16MB", "error");
            return;
        }

        // Show loading state
        uploadBtn.disabled = true;
        btnText.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
        spinner.classList.remove("d-none");
        
        // Show processing modal
        processingModal.show();
        
        // Hide previous results if exists
        if (resultsSection) {
            resultsSection.style.display = 'none';
        }

        const formData = new FormData();
        formData.append("file", file); // CHANGED FROM "report" TO "file"

        try {
            console.log("Sending upload request to /upload_report...");
            
            const response = await fetch("/upload_report", {
                method: "POST",
                body: formData
            });

            console.log("Response status:", response.status);
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                
                if (response.ok) {
                    console.log("Upload successful:", data);
                    showStatus("Analysis complete!", "success");
                    
                    // Display results if we have a results section
                    if (resultsSection && resultsContent && data) {
                        displayResults(data);
                    }
                    
                    // Redirect if provided
                    if (data.redirect) {
                        setTimeout(() => {
                            window.location.href = data.redirect;
                        }, 1000);
                    }
                } else {
                    console.error("Server error:", data);
                    showStatus(data.error || data.message || "Server error occurred", "error");
                }
            } else {
                // Not JSON response
                const text = await response.text();
                console.error("Non-JSON response:", text.substring(0, 200));
                
                if (text.includes("<!DOCTYPE") || text.includes("<html>")) {
                    showStatus("Server returned HTML instead of JSON. Check backend.", "error");
                } else {
                    showStatus("Server returned unexpected format: " + text.substring(0, 100), "error");
                }
            }

        } catch (err) {
            console.error("Upload error:", err);
            
            let errorMsg = "Error uploading file. Please try again.";
            if (err.message && err.message.includes("Failed to fetch")) {
                errorMsg = "Cannot connect to server. Make sure backend is running.";
            }
            
            showStatus(errorMsg, "error");
        } finally {
            // Reset button state
            uploadBtn.disabled = false;
            btnText.innerHTML = '<i class="fas fa-upload me-2"></i>Upload & Analyze';
            spinner.classList.add("d-none");
            
            // Hide modal after a delay
            setTimeout(() => {
                processingModal.hide();
            }, 1000);
        }
    });

    // Function to display results
    function displayResults(data) {
        if (!resultsContent) return;
        
        console.log("Displaying results:", data);
        
        // Build results HTML based on your backend response
        let html = `
            <h3 class="mb-4">
                <i class="fas fa-file-medical-alt text-primary me-2"></i>
                Report Analysis Results
                ${data.filename ? `<small class="text-muted ms-2">${data.filename}</small>` : ''}
            </h3>
        `;

        // Summary Section
        if (data.summary) {
            html += `
                <div class="alert alert-primary">
                    <i class="fas fa-chart-bar me-2"></i>
                    <strong>Analysis Summary</strong>
                    <div class="mt-2">
                        <span class="badge bg-primary me-2">
                            <i class="fas fa-pills me-1"></i> ${data.summary.medications_found || 0} Medications
                        </span>
                        <span class="badge bg-success me-2">
                            <i class="fas fa-stethoscope me-1"></i> ${data.summary.symptoms_detected || 0} Symptoms
                        </span>
                        <span class="badge bg-info">
                            <i class="fas fa-capsules me-1"></i> ${data.summary.medication_matches || 0} Matches
                        </span>
                    </div>
                </div>
            `;
        }

        // Extracted Text Preview
        if (data.extracted_text) {
            html += `
                <div class="card mb-3">
                    <div class="card-header">
                        <i class="fas fa-text-height me-2"></i>Extracted Text
                        <button class="btn btn-sm btn-outline-secondary float-end" type="button" data-bs-toggle="collapse" data-bs-target="#extractedText">
                            Show/Hide
                        </button>
                    </div>
                    <div class="collapse" id="extractedText">
                        <div class="card-body">
                            <pre style="max-height: 300px; overflow: auto; white-space: pre-wrap;">${data.extracted_text}</pre>
                        </div>
                    </div>
                </div>
            `;
        }

        // Medications Found
        if (data.medical_info && data.medical_info.medications && data.medical_info.medications.length > 0) {
            html += `
                <h4 class="mt-4 mb-3">
                    <i class="fas fa-capsules text-primary me-2"></i>
                    Medications Found in Report
                </h4>
            `;
            
            data.medical_info.medications.forEach((med, index) => {
                html += `
                    <div class="card mb-3">
                        <div class="card-body">
                            <h5 class="card-title">
                                <i class="fas fa-pills me-2"></i>
                                ${med.name || 'Unknown Medication'}
                                <span class="badge bg-info float-end">
                                    <i class="fas fa-prescription me-1"></i>
                                    Extracted
                                </span>
                            </h5>
                            
                            <div class="row mt-2">
                                <div class="col-md-4">
                                    <p><strong><i class="fas fa-weight me-1"></i> Dosage:</strong><br>
                                    ${med.dosage || 'Not specified'}</p>
                                </div>
                                <div class="col-md-4">
                                    <p><strong><i class="fas fa-clock me-1"></i> Frequency:</strong><br>
                                    ${med.frequency || 'Not specified'}</p>
                                </div>
                                <div class="col-md-4">
                                    <p><strong><i class="fas fa-file-alt me-1"></i> Context:</strong><br>
                                    <small>${med.context ? med.context.substring(0, 100) + '...' : 'No context'}</small></p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            html += `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    No medications detected in the report
                </div>
            `;
        }

        // Matched Medications from Database
        if (data.matched_medications && data.matched_medications.length > 0) {
            html += `
                <h4 class="mt-4 mb-3">
                    <i class="fas fa-database text-success me-2"></i>
                    Database Matches & Recommendations
                </h4>
            `;
            
            data.matched_medications.forEach((match, index) => {
                const confidenceClass = match.confidence === 'high' ? 'border-success' : 'border-warning';
                
                html += `
                    <div class="card mb-3 ${confidenceClass}">
                        <div class="card-body">
                            <h5 class="card-title">
                                <i class="fas fa-check-circle text-success me-2"></i>
                                ${match.recommended_medicine}
                                <span class="badge ${match.confidence === 'high' ? 'bg-success' : 'bg-warning'} float-end">
                                    <i class="fas fa-${match.confidence === 'high' ? 'star' : 'info-circle'} me-1"></i>
                                    ${match.confidence} match
                                </span>
                            </h5>
                            <h6 class="card-subtitle mb-3 text-muted">For: ${match.condition}</h6>
                            
                            <div class="row">
                                <div class="col-md-3">
                                    <p><strong><i class="fas fa-weight me-1"></i> Dosage:</strong><br>
                                    ${match.dosage}</p>
                                </div>
                                <div class="col-md-3">
                                    <p><strong><i class="fas fa-calendar-alt me-1"></i> Duration:</strong><br>
                                    ${match.duration}</p>
                                </div>
                                <div class="col-md-3">
                                    <p><strong><i class="fas fa-shield-alt me-1"></i> Precautions:</strong><br>
                                    <small>${match.precautions}</small></p>
                                </div>
                                <div class="col-md-3">
                                    <p><strong><i class="fas fa-sticky-note me-1"></i> Notes:</strong><br>
                                    <small>${match.notes}</small></p>
                                </div>
                            </div>
                            
                            ${match.source === 'symptom_match' ? `
                                <div class="alert alert-info mt-3">
                                    <i class="fas fa-lightbulb me-2"></i>
                                    <strong>Matched based on symptoms:</strong> 
                                    ${match.matched_symptoms ? match.matched_symptoms.join(', ') : 'Unknown symptoms'}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
        }

        // Medical Advice from DeepSeek
        if (data.medical_advice) {
            html += `
                <div class="card mt-4">
                    <div class="card-header bg-purple text-white">
                        <i class="fas fa-robot me-2"></i>
                        AI Health Assistant Advice
                    </div>
                    <div class="card-body">
                        <div class="ai-advice">
                            ${formatAIAdvice(data.medical_advice)}
                        </div>
                        <div class="mt-3 text-muted small">
                            <i class="fas fa-info-circle me-1"></i>
                            This is AI-generated health advice. Always consult a healthcare professional for medical decisions.
                        </div>
                    </div>
                </div>
            `;
        }

        // Add reset button
        html += `
            <div class="text-center mt-4">
                <button class="btn btn-primary" onclick="resetUploadForm()">
                    <i class="fas fa-upload me-2"></i>Upload Another Report
                </button>
            </div>
        `;

        resultsContent.innerHTML = html;
        resultsSection.style.display = 'block';
        
        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
        
        // Initialize Bootstrap tooltips if any
        if (typeof bootstrap !== 'undefined') {
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.map(function (tooltipTriggerEl) {
                return new bootstrap.Tooltip(tooltipTriggerEl);
            });
        }
    }

    // Helper function to format AI advice
    function formatAIAdvice(text) {
        if (!text) return '';
        return text
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/•/g, '<br>• ')
            .replace(/^\s*[-*]\s*/gm, '• ')
            .replace(/^<p>/, '')
            .replace(/<\/p>$/, '');
    }

    // Reset function
    window.resetUploadForm = function() {
        form.reset();
        fileInfo.innerHTML = '';
        statusDiv.innerHTML = '';
        if (resultsSection) {
            resultsSection.style.display = 'none';
        }
    };

    // Click on drop area to trigger file input
    dropArea.addEventListener('click', () => {
        fileInput.click();
    });
});