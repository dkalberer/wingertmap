{{- define "wingert.name" -}}
{{- .Chart.Name }}
{{- end }}

{{- define "wingert.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "wingert.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "wingert.selectorLabels" -}}
app.kubernetes.io/name: {{ include "wingert.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
