import csvParse from 'csv-parse';
import fs from 'fs';
import path from 'path';
import { getCustomRepository, getRepository, In } from 'typeorm';

import uploadConfig from '../config/upload';
import AppError from '../errors/AppError';
import Category from '../models/Category';

import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface ParsedCsvData {
  title: string;
  type: string;
  value: number;
  categoryTitle: string;
}

class ImportTransactionsService {
  public async execute(csvFileName: string): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const csvFilePath = path.join(uploadConfig.directory, csvFileName);

    const csvFileData = await this.loadCSV(csvFilePath);

    const categoriesTitle: Array<string> = [];

    const csvParsedDatas: Array<ParsedCsvData> = csvFileData.map(data => {
      const [title, type, value, categoryTitle] = data;

      if (!title || !type || !value || !categoryTitle) {
        throw new AppError('Invalid format of the csv');
      }

      const findCategory = categoriesTitle.find(
        exitedCategoryTitle => exitedCategoryTitle === categoryTitle,
      );

      if (!findCategory) {
        categoriesTitle.push(categoryTitle);
      }

      return {
        title,
        type,
        value: Number(value),
        categoryTitle,
      };
    });

    const categories = await this.getCategories(categoriesTitle);

    const transactions: Array<Transaction> = [];

    csvParsedDatas.forEach(({ title, type, value, categoryTitle }) => {
      const findedCategory = categories.find(
        category => categoryTitle === category.title,
      );

      if (findedCategory) {
        if (type === 'income' || type === 'outcome') {
          const newTransaction = transactionsRepository.create({
            title,
            type,
            value,
            category: findedCategory,
          });

          transactions.push(newTransaction);
        } else {
          throw new AppError('Wrong type value');
        }
      }
    });

    await transactionsRepository.save(transactions);

    return transactions;
  }

  private async getCategories(titles: Array<string>): Promise<Array<Category>> {
    const categoriesRepository = getRepository(Category);

    const findCategories = await categoriesRepository.find({
      where: { title: In(titles) },
    });

    const categories = titles.map(title => {
      const findedCategory = findCategories.find(
        category => category.title === title,
      );

      if (findedCategory) {
        return findedCategory;
      }

      return categoriesRepository.create({ title });
    });

    await categoriesRepository.save(categories);

    return categories;
  }

  private async loadCSV(csvFilePath: string): Promise<Array<Array<string>>> {
    const readCSVStream = fs.createReadStream(csvFilePath);

    const parseStream = csvParse({
      from_line: 2,
      ltrim: true,
      rtrim: true,
    });

    const parseCSV = readCSVStream.pipe(parseStream);

    const lines: Array<Array<string>> = [];

    parseCSV.on('data', line => {
      lines.push(line);
    });

    await new Promise(resolve => {
      parseCSV.on('end', resolve);
    });

    return lines;
  }
}

export default ImportTransactionsService;
