import os
import PyPDF2
import sys

# PDF文件所在的目录
pdf_dir = r"c:\Users\Administrator\Desktop\2025网络安全项目资料\2024年软件杯版本"

# 需要分析的6个文件名
pdf_files = [
    "《智链分析溯源平台》概要介绍文档.pdf",
    "《智链分析溯源平台》详细设计方案.pdf",
    "《智链分析溯源平台》需求规格文档.pdf",
    "《智链分析溯源平台》项目介绍PPT.pdf",
    "《智链分析溯源平台》项目操作手册.pdf",
    "《智链分析溯源平台》项目部署文档.pdf"
]

def extract_text_from_pdf(file_path, max_pages=5):
    """提取PDF前几页的文本"""
    text_content = ""
    try:
        with open(file_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            num_pages = len(reader.pages)
            # print(f"--- Processing {os.path.basename(file_path)} ({num_pages} pages) ---")
            
            # 读取前max_pages页，或者全部如果少于max_pages
            for i in range(min(num_pages, max_pages)):
                page = reader.pages[i]
                text = page.extract_text()
                if text:
                    text_content += text + "\n"
    except Exception as e:
        return f"Error reading {file_path}: {str(e)}"
    return text_content

print("开始分析PDF文档内容...\n")

with open("pdf_content.txt", "w", encoding="utf-8") as f:
    for pdf_file in pdf_files:
        full_path = os.path.join(pdf_dir, pdf_file)
        if os.path.exists(full_path):
            f.write(f"\n{'='*20} {pdf_file} {'='*20}\n")
            print(f"正在读取: {pdf_file}")
            # 提取前20页
            content = extract_text_from_pdf(full_path, max_pages=20)
            f.write(content)
            f.write("\n\n")
        else:
            f.write(f"文件不存在: {full_path}\n")

print("PDF内容已保存到 pdf_content.txt")
